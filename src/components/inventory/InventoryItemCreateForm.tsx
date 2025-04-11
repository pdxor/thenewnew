import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/supabase';
import { 
  Package, 
  Folder, 
  CheckSquare, 
  Save, 
  Tags, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  DollarSign, 
  Sparkles, 
  Search, 
  Loader2, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { 
  generateImage, 
  generateImagePrompt, 
  generateProductDescription, 
  searchProduct 
} from '../../lib/openai';
import { estimateItemPrice } from '../../lib/priceEstimation';
import { cleanItemTitle } from '../../lib/titleFilter';

type Project = Database['public']['Tables']['projects']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];

interface ProductInfo {
  description: string;
  priceRange: string;
  features: string[];
  whereToBuy: string[];
  purchaseLink: string;
}

const InventoryItemCreateForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get task_id or project_id from query params if present
  const queryParams = new URLSearchParams(location.search);
  const taskIdFromQuery = queryParams.get('task_id');
  const projectIdFromQuery = queryParams.get('project_id');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<'needed_supply' | 'owned_resource' | 'borrowed_or_rental'>('needed_supply');
  const [isFundraiser, setIsFundraiser] = useState(false);
  const [quantityNeeded, setQuantityNeeded] = useState<number | ''>('');
  const [quantityOwned, setQuantityOwned] = useState<number | ''>('');
  const [quantityBorrowed, setQuantityBorrowed] = useState<number | ''>('');
  const [unit, setUnit] = useState('');
  const [productLink, setProductLink] = useState('');
  const [infoLink, setInfoLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [newTag, setNewTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [projectId, setProjectId] = useState(projectIdFromQuery || '');
  const [taskId, setTaskId] = useState(taskIdFromQuery || '');
  
  // New fields for price tracking
  const [price, setPrice] = useState<string>('');
  const [isEstimatedPrice, setIsEstimatedPrice] = useState(false);
  const [priceCurrency, setPriceCurrency] = useState('USD');
  
  // AI-related states
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [isEstimatingPrice, setIsEstimatingPrice] = useState(false);
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Fetch user's projects
  useEffect(() => {
    if (!user) return;
    
    const fetchProjects = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .or(`created_by.eq.${user.id},team.cs.{${user.id}}`)
          .order('updated_at', { ascending: false });
          
        if (error) throw error;
        
        setProjects(data || []);
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };
    
    fetchProjects();
  }, [user]);
  
  // Fetch tasks when project is selected
  useEffect(() => {
    if (!user || !projectId) {
      setTasks([]);
      return;
    }
    
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false });
          
        if (error) throw error;
        
        setTasks(data || []);
      } catch (err) {
        console.error('Error fetching tasks:', err);
      }
    };
    
    fetchTasks();
  }, [user, projectId]);
  
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Convert empty string to null for number fields
      const parsedQuantityNeeded = quantityNeeded === '' ? null : Number(quantityNeeded);
      const parsedQuantityOwned = quantityOwned === '' ? null : Number(quantityOwned);
      const parsedQuantityBorrowed = quantityBorrowed === '' ? null : Number(quantityBorrowed);
      
      // Validate that at least one quantity is provided based on item type
      if (
        (itemType === 'needed_supply' && parsedQuantityNeeded === null) ||
        (itemType === 'owned_resource' && parsedQuantityOwned === null) ||
        (itemType === 'borrowed_or_rental' && parsedQuantityBorrowed === null)
      ) {
        throw new Error(`Please provide a quantity for this ${formatItemType(itemType)}`);
      }
      
      // Parse price
      const parsedPrice = price ? parseFloat(price) : null;
      
      // Clean the title to remove leading "I" if needed
      const cleanedTitle = cleanItemTitle(title);
      
      // Inventory item data
      const itemData = {
        title: cleanedTitle,
        description: description || null,
        item_type: itemType,
        fundraiser: isFundraiser,
        tags: tags.length > 0 ? tags : null,
        quantity_needed: parsedQuantityNeeded,
        quantity_owned: parsedQuantityOwned,
        quantity_borrowed: parsedQuantityBorrowed,
        unit: unit || null,
        product_link: productLink || null,
        info_link: infoLink || null,
        image_url: imageUrl || null,
        associated_task_id: taskId || null,
        project_id: projectId || null,
        price: parsedPrice,
        estimated_price: parsedPrice ? isEstimatedPrice : null,
        price_currency: parsedPrice ? priceCurrency : null,
        price_date: parsedPrice ? new Date().toISOString() : null,
        price_source: parsedPrice ? (isEstimatedPrice ? 'AI Estimate' : 'User Input') : null,
        added_by: user.id,
      };
      
      // Insert item into database
      const { data, error } = await supabase
        .from('items')
        .insert(itemData)
        .select('id')
        .single();
        
      if (error) throw error;
      
      setSuccess('Inventory item created successfully!');
      
      // Navigate to appropriate page after success
      setTimeout(() => {
        if (projectId) {
          navigate(`/projects/${projectId}/inventory`);
        } else if (taskId) {
          navigate(`/tasks/${taskId}`);
        } else {
          navigate('/inventory');
        }
      }, 1500);
      
    } catch (err) {
      console.error('Error creating inventory item:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while creating the inventory item');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Format item type for display
  const formatItemType = (type: string) => {
    switch (type) {
      case 'needed_supply':
        return 'Needed Supply';
      case 'owned_resource':
        return 'Owned Resource';
      case 'borrowed_or_rental':
        return 'Borrowed/Rental';
      default:
        return type;
    }
  };

  // Handle item type change
  const handleItemTypeChange = (newType: 'needed_supply' | 'owned_resource' | 'borrowed_or_rental') => {
    setItemType(newType);
    
    // Reset quantities when changing item type
    if (newType === 'needed_supply') {
      setQuantityOwned('');
      setQuantityBorrowed('');
      if (quantityNeeded === '') setQuantityNeeded(1);
    } else if (newType === 'owned_resource') {
      setQuantityNeeded('');
      setQuantityBorrowed('');
      if (quantityOwned === '') setQuantityOwned(1);
    } else if (newType === 'borrowed_or_rental') {
      setQuantityNeeded('');
      setQuantityOwned('');
      if (quantityBorrowed === '') setQuantityBorrowed(1);
    }
  };

  // Generate image for the item
  const handleGenerateImage = async () => {
    if (!user || !title) {
      setAiError('Please enter a title first');
      return;
    }
    
    setIsGeneratingImage(true);
    setAiError(null);
    
    try {
      // First generate a detailed prompt for the image
      let prompt = '';
      
      if (imagePrompt) {
        prompt = imagePrompt;
      } else {
        prompt = await generateImagePrompt({
          userId: user.id,
          prompt: `Create a detailed image generation prompt for a product photo of: ${title}. ${description ? `Description: ${description}` : ''}`
        });
        
        setImagePrompt(prompt);
      }
      
      // Then generate the image using the prompt
      const imageUrl = await generateImage({
        userId: user.id,
        prompt: prompt,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural'
      });
      
      setImageUrl(imageUrl);
      
    } catch (err) {
      console.error('Error generating image:', err);
      if (err instanceof Error) {
        setAiError(err.message);
      } else {
        setAiError('An error occurred while generating the image');
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Generate description for the item
  const handleGenerateDescription = async () => {
    if (!user || !title) {
      setAiError('Please enter a title first');
      return;
    }
    
    setIsGeneratingDescription(true);
    setAiError(null);
    
    try {
      const generatedDescription = await generateProductDescription({
        userId: user.id,
        prompt: `Create a detailed product description for: ${title}. ${description ? `Current description: ${description}` : ''}`
      });
      
      setDescription(generatedDescription);
      
    } catch (err) {
      console.error('Error generating description:', err);
      if (err instanceof Error) {
        setAiError(err.message);
      } else {
        setAiError('An error occurred while generating the description');
      }
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  // Search for product information
  const handleSearchProduct = async () => {
    if (!user || !title) {
      setAiError('Please enter a title first');
      return;
    }
    
    setIsSearchingProduct(true);
    setAiError(null);
    
    try {
      const productInfoJson = await searchProduct({
        userId: user.id,
        query: title
      });
      
      const productInfo = JSON.parse(productInfoJson) as ProductInfo;
      setProductInfo(productInfo);
      
      // Auto-fill fields with the product information
      if (productInfo.description && !description) {
        setDescription(productInfo.description);
      }
      
      if (productInfo.priceRange) {
        // Extract the average price from the range
        const priceMatch = productInfo.priceRange.match(/\$(\d+(?:\.\d+)?)/g);
        if (priceMatch && priceMatch.length > 0) {
          // If there are multiple prices, take the average
          if (priceMatch.length > 1) {
            const prices = priceMatch.map(p => parseFloat(p.replace('$', '')));
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            setPrice(avgPrice.toFixed(2));
            setIsEstimatedPrice(true);
          } else {
            // If there's just one price, use that
            setPrice(priceMatch[0].replace('$', ''));
            setIsEstimatedPrice(true);
          }
        }
      }
      
      if (productInfo.purchaseLink && !productLink) {
        setProductLink(productInfo.purchaseLink);
      }
      
      // Add features as tags
      if (productInfo.features && productInfo.features.length > 0) {
        const newTags = [...tags];
        productInfo.features.forEach(feature => {
          const shortFeature = feature.split(' ').slice(0, 2).join(' ');
          if (!newTags.includes(shortFeature) && shortFeature.length > 0) {
            newTags.push(shortFeature);
          }
        });
        setTags(newTags);
      }
      
    } catch (err) {
      console.error('Error searching for product:', err);
      if (err instanceof Error) {
        setAiError(err.message);
      } else {
        setAiError('An error occurred while searching for product information');
      }
    } finally {
      setIsSearchingProduct(false);
    }
  };

  // Estimate price using AI
  const handleEstimatePrice = async () => {
    if (!user || !title) {
      setAiError('Please enter a title first');
      return;
    }
    
    setIsEstimatingPrice(true);
    setAiError(null);
    
    try {
      // Use AI to estimate price
      const estimate = await estimateItemPrice(
        user.id,
        title,
        description
      );
      
      // Update the form fields
      setPrice(estimate.price.toString());
      setPriceCurrency(estimate.currency);
      setIsEstimatedPrice(true);
      
    } catch (err) {
      console.error('Error estimating price:', err);
      if (err instanceof Error) {
        setAiError(err.message);
      } else {
        setAiError('An error occurred while estimating the price');
      }
    } finally {
      setIsEstimatingPrice(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <Package className="h-6 w-6 mr-2 text-green-600" />
        Add Inventory Item
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      {aiError && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>{aiError}</p>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="title">
            Item Title *
          </label>
          <div className="flex">
            <input
              id="title"
              type="text"
              className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter item title"
              required
            />
            <button
              type="button"
              onClick={handleSearchProduct}
              disabled={isSearchingProduct || !title}
              className="px-3 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
              title="Search for product information"
            >
              {isSearchingProduct ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </button>
          </div>
          {title.match(/^[Ii]\s+/) && (
            <p className="text-xs text-amber-600 mt-1">
              Note: The leading "I" will be removed from the title unless it's part of a product name like "iPod".
            </p>
          )}
        </div>
        
        {/* Product Info Panel */}
        {productInfo && (
          <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Product Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-blue-700 mb-1">Price Range</h4>
                <p className="text-gray-700">{productInfo.priceRange}</p>
              </div>
              
              <div>
                <h4 className="font-medium text-blue-700 mb-1">Where to Buy</h4>
                <ul className="list-disc list-inside text-gray-700">
                  {productInfo.whereToBuy.map((place, index) => (
                    <li key={index}>{place}</li>
                  ))}
                </ul>
              </div>
              
              <div className="md:col-span-2">
                <h4 className="font-medium text-blue-700 mb-1">Features</h4>
                <ul className="list-disc list-inside text-gray-700">
                  {productInfo.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
              
              {productInfo.purchaseLink && (
                <div className="md:col-span-2">
                  <h4 className="font-medium text-blue-700 mb-1">Purchase Link</h4>
                  <a 
                    href={productInfo.purchaseLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center"
                  >
                    <LinkIcon className="h-4 w-4 mr-1" />
                    {productInfo.purchaseLink}
                  </a>
                </div>
              )}
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setProductInfo(null)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-gray-700 text-sm font-medium" htmlFor="description">
              Description
            </label>
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={isGeneratingDescription || !title}
              className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:bg-purple-300 flex items-center"
            >
              {isGeneratingDescription ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Generate Description
            </button>
          </div>
          <textarea
            id="description"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter item description (optional)"
            rows={3}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="itemType">
            Item Type *
          </label>
          <div className="relative">
            <Package className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <select
              id="itemType"
              className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
              value={itemType}
              onChange={(e) => handleItemTypeChange(e.target.value as any)}
              required
            >
              <option value="needed_supply">Needed Supply</option>
              <option value="owned_resource">Owned Resource</option>
              <option value="borrowed_or_rental">Borrowed/Rental</option>
            </select>
            <div className="absolute right-3 top-3 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="mb-4 flex items-center">
          <input
            id="isFundraiser"
            type="checkbox"
            className="h-4 w-4 text-green-500 focus:ring-green-400 border-gray-300 rounded"
            checked={isFundraiser}
            onChange={(e) => setIsFundraiser(e.target.checked)}
          />
          <label className="ml-2 block text-gray-700 text-sm font-medium" htmlFor="isFundraiser">
            This item needs fundraising
          </label>
        </div>
        
        {/* Price Information */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-green-600" />
              Price Information
            </h3>
            <button
              type="button"
              onClick={handleEstimatePrice}
              disabled={isEstimatingPrice || !title}
              className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:bg-purple-300 flex items-center"
            >
              {isEstimatingPrice ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Estimate Price
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="price">
                Price
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="priceCurrency">
                Currency
              </label>
              <select
                id="priceCurrency"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
                value={priceCurrency}
                onChange={(e) => setPriceCurrency(e.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>
            
            <div className="flex items-center">
              <input
                id="isEstimatedPrice"
                type="checkbox"
                className="h-4 w-4 text-green-500 focus:ring-green-400 border-gray-300 rounded"
                checked={isEstimatedPrice}
                onChange={(e) => setIsEstimatedPrice(e.target.checked)}
              />
              <label className="ml-2 block text-gray-700 text-sm font-medium" htmlFor="isEstimatedPrice">
                This is an estimated price
              </label>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Show different quantity fields based on item type */}
          {itemType === 'needed_supply' && (
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="quantityNeeded">
                Quantity Needed *
              </label>
              <input
                id="quantityNeeded"
                type="number"
                min="0"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={quantityNeeded}
                onChange={(e) => setQuantityNeeded(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>
          )}
          
          {itemType === 'owned_resource' && (
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="quantityOwned">
                Quantity Owned *
              </label>
              <input
                id="quantityOwned"
                type="number"
                min="0"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={quantityOwned}
                onChange={(e) => setQuantityOwned(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>
          )}
          
          {itemType === 'borrowed_or_rental' && (
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="quantityBorrowed">
                Quantity Borrowed *
              </label>
              <input
                id="quantityBorrowed"
                type="number"
                min="0"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={quantityBorrowed}
                onChange={(e) => setQuantityBorrowed(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>
          )}
          
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="unit">
              Unit of Measurement
            </label>
            <input
              id="unit"
              type="text"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g., pieces, kg, meters"
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag, index) => (
              <div 
                key={index}
                className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-sm flex items-center"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 text-gray-600 hover:text-gray-900"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex">
            <div className="relative flex-1">
              <Tags className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag (e.g., tools, materials, garden)"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
            </div>
            <button
              type="button"
              className="px-4 py-2 bg-gray-600 text-white rounded-r-md hover:bg-gray-700"
              onClick={handleAddTag}
            >
              Add
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="productLink">
            Product Link
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <input
              id="productLink"
              type="url"
              className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={productLink}
              onChange={(e) => setProductLink(e.target.value)}
              placeholder="https://example.com/product"
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="infoLink">
            Information Link
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <input
              id="infoLink"
              type="url"
              className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={infoLink}
              onChange={(e) => setInfoLink(e.target.value)}
              placeholder="https://example.com/info"
            />
          </div>
        </div>
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-gray-700 text-sm font-medium" htmlFor="imageUrl">
              Image URL
            </label>
            <button
              type="button"
              onClick={handleGenerateImage}
              disabled={isGeneratingImage || !title}
              className="text-sm bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:bg-purple-300 flex items-center"
            >
              {isGeneratingImage ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Generate Image
            </button>
          </div>
          
          <div className="relative">
            <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <input
              id="imageUrl"
              type="url"
              className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          
          {/* Image Prompt Input */}
          {isGeneratingImage && (
            <div className="mt-2">
              <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="imagePrompt">
                Image Prompt (Edit to customize the generated image)
              </label>
              <div className="flex">
                <textarea
                  id="imagePrompt"
                  className="w-full px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Detailed prompt for image generation..."
                  rows={2}
                />
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  className="px-3 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 flex items-center"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          
          {/* Image Preview */}
          {imageUrl && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 mb-2">Image Preview:</p>
              <div className="border border-gray-200 rounded-md p-2 bg-gray-50">
                <img 
                  src={imageUrl} 
                  alt={title} 
                  className="max-h-40 mx-auto object-contain"
                  onError={() => setError('Invalid image URL. Please check the URL and try again.')}
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="projectId">
              Associated Project
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <select
                id="projectId"
                className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setTaskId(''); // Reset task when project changes
                }}
              >
                <option value="">Select a project (optional)</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
              <div className="absolute right-3 top-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="taskId">
              Associated Task
            </label>
            <div className="relative">
              <CheckSquare className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <select
                id="taskId"
                className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                disabled={!projectId || tasks.length === 0}
              >
                <option value="">Select a task (optional)</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
              <div className="absolute right-3 top-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {projectId && tasks.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">No tasks available for this project</p>
            )}
          </div>
        </div>
        
        <div className="flex justify-between">
          <button
            type="submit"
            className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Create Item
              </>
            )}
          </button>
          
          <button
            type="button"
            className="bg-gray-200 text-gray-700 py-2 px-6 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default InventoryItemCreateForm;