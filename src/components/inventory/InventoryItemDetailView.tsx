import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Database } from '../../types/supabase';
import { 
  Package, 
  Edit, 
  Trash2, 
  Folder, 
  CheckSquare, 
  Tag, 
  ExternalLink, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  Calendar,
  ShoppingCart,
  X,
  Sparkles
} from 'lucide-react';
import { searchProductWithGoogle, extractPrice, extractCurrency } from '../../lib/googleSearch';
import { estimateItemPrice, updateItemPrice } from '../../lib/priceEstimation';

type InventoryItem = Database['public']['Tables']['items']['Row'];

interface ProductSearchResult {
  title: string;
  description: string;
  price: string | null;
  link: string;
  imageUrl: string | null;
  source: string;
}

const InventoryItemDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [taskName, setTaskName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [searchingPurchaseLink, setSearchingPurchaseLink] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [estimatingPrice, setEstimatingPrice] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    
    const fetchItem = async () => {
      try {
        // Fetch item
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('*')
          .eq('id', id)
          .single();
          
        if (itemError) throw itemError;
        
        if (!itemData) {
          setError('Item not found');
          return;
        }
        
        setItem(itemData);
        
        // Fetch project name if item is associated with a project
        if (itemData.project_id) {
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('title')
            .eq('id', itemData.project_id)
            .single();
            
          if (projectError) console.error('Error fetching project:', projectError);
          else setProjectName(projectData?.title || null);
        }
        
        // Fetch task name if item is associated with a task
        if (itemData.associated_task_id) {
          const { data: taskData, error: taskError } = await supabase
            .from('tasks')
            .select('title')
            .eq('id', itemData.associated_task_id)
            .single();
            
          if (taskError) console.error('Error fetching task:', taskError);
          else setTaskName(taskData?.title || null);
        }
        
      } catch (err) {
        console.error('Error fetching inventory item details:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An error occurred while loading the inventory item');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchItem();
  }, [id, user]);
  
  const handleDelete = async () => {
    if (!item || !user) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', item.id);
        
      if (error) throw error;
      
      // Navigate back to inventory list or project inventory
      if (item.project_id) {
        navigate(`/projects/${item.project_id}/inventory`);
      } else {
        navigate('/inventory');
      }
      
    } catch (err) {
      console.error('Error deleting inventory item:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while deleting the inventory item');
      }
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // Convert needed supply to owned resource
  const handleConvertToOwned = async () => {
    if (!item || !user) return;
    
    setUpdatingStatus(true);
    try {
      // Update the item type and move the quantity from needed to owned
      const { error } = await supabase
        .from('items')
        .update({
          item_type: 'owned_resource',
          quantity_owned: item.quantity_needed,
          quantity_needed: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);
        
      if (error) throw error;
      
      // Update the local state
      setItem({
        ...item,
        item_type: 'owned_resource',
        quantity_owned: item.quantity_needed,
        quantity_needed: 0
      });
      
    } catch (err) {
      console.error('Error updating inventory item status:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while updating the inventory item status');
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Find purchase link using Google Search API
  const handleFindPurchaseLink = async () => {
    if (!item || !user) return;
    
    setSearchingPurchaseLink(true);
    setError(null);
    
    try {
      // Use Google Search API to find product information
      const searchResults = await searchProductWithGoogle(
        user.id,
        item.title,
        5 // Get top 5 results
      );
      
      if (searchResults.length === 0) {
        throw new Error(`No search results found for "${item.title}"`);
      }
      
      // Save the search results for display
      setSearchResults(searchResults);
      setShowSearchResults(true);
      
    } catch (err) {
      console.error('Error finding purchase link:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to find purchase link');
      }
    } finally {
      setSearchingPurchaseLink(false);
    }
  };
  
  // Select a specific search result to use
  const handleSelectSearchResult = async (result: ProductSearchResult) => {
    if (!item || !user) return;
    
    try {
      // Update the item with the purchase link
      const { error } = await supabase
        .from('items')
        .update({
          product_link: result.link,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);
        
      if (error) throw error;
      
      // Update the local state
      setItem({
        ...item,
        product_link: result.link
      });
      
      // If we found a price, update that too
      if (result.price) {
        const price = extractPrice(result.price);
        const currency = extractCurrency(result.price);
        
        if (price !== null) {
          const { error: priceError } = await supabase
            .from('items')
            .update({
              price: price,
              estimated_price: true,
              price_currency: currency,
              price_date: new Date().toISOString(),
              price_source: result.source
            })
            .eq('id', item.id);
            
          if (priceError) {
            console.error('Error updating price:', priceError);
          } else {
            // Update the local state
            setItem({
              ...item,
              price: price,
              estimated_price: true,
              price_currency: currency,
              price_date: new Date().toISOString(),
              price_source: result.source
            });
          }
        }
      }
      
      // If we found an image URL and the item doesn't have one, update that too
      if (result.imageUrl && !item.image_url) {
        const { error: imageError } = await supabase
          .from('items')
          .update({
            image_url: result.imageUrl
          })
          .eq('id', item.id);
          
        if (imageError) {
          console.error('Error updating image URL:', imageError);
        } else {
          // Update the local state
          setItem({
            ...item,
            image_url: result.imageUrl
          });
        }
      }
      
      // Hide the search results
      setShowSearchResults(false);
      
    } catch (err) {
      console.error('Error updating item with search result:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update item with search result');
      }
    }
  };

  // Estimate price using AI
  const handleEstimatePrice = async () => {
    if (!item || !user) return;
    
    setEstimatingPrice(true);
    setError(null);
    
    try {
      // Use AI to estimate price
      const estimate = await estimateItemPrice(
        user.id,
        item.title,
        item.description
      );
      
      // Update the item with the estimated price
      const success = await updateItemPrice(
        item.id,
        estimate.price,
        estimate.currency,
        estimate.source
      );
      
      if (!success) {
        throw new Error('Failed to update item with estimated price');
      }
      
      // Update the local state
      setItem({
        ...item,
        price: estimate.price,
        estimated_price: true,
        price_currency: estimate.currency,
        price_date: new Date().toISOString(),
        price_source: estimate.source
      });
      
    } catch (err) {
      console.error('Error estimating price:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to estimate price');
      }
    } finally {
      setEstimatingPrice(false);
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
  
  // Get item type color
  const getItemTypeColor = (type: string) => {
    switch (type) {
      case 'needed_supply':
        return 'bg-yellow-100 text-yellow-800';
      case 'owned_resource':
        return 'bg-green-100 text-green-800';
      case 'borrowed_or_rental':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format price with currency symbol
  const formatPrice = (price: number | null, currency: string = 'USD') => {
    if (price === null) return 'Not specified';
    
    const currencySymbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'CAD': 'C$',
      'AUD': 'A$',
      'JPY': '¥'
    };
    
    const symbol = currencySymbols[currency] || '$';
    
    return `${symbol}${price.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error</p>
        <p>{error}</p>
        <div className="mt-4">
          <button
            onClick={() => navigate('/inventory')}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Return to Inventory
          </button>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        Item not found. It may have been deleted or you don't have access.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center">
              <AlertCircle className="h-6 w-6 mr-2" />
              Delete Inventory Item
            </h3>
            <p className="mb-4">Are you sure you want to delete "{item.title}"? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Item
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Search Results Modal */}
      {showSearchResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl mx-4 w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-blue-600 flex items-center">
                <ShoppingCart className="h-6 w-6 mr-2" />
                Purchase Options for "{item.title}"
              </h3>
              <button
                onClick={() => setShowSearchResults(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No purchase options found. Try a different search term.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-4">
                      {result.imageUrl && (
                        <div className="flex-shrink-0">
                          <img 
                            src={result.imageUrl} 
                            alt={result.title} 
                            className="w-20 h-20 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800">{result.title}</h4>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{result.description}</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          {result.price && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                              {result.price}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            Source: {result.source}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => handleSelectSearchResult(result)}
                          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowSearchResults(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button 
              onClick={() => setError(null)} 
              className="float-right text-red-700 hover:text-red-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
              <Package className="h-6 w-6 mr-2 text-green-600" />
              {item.title}
            </h1>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getItemTypeColor(item.item_type)}`}>
                {formatItemType(item.item_type)}
              </span>
              
              {item.fundraiser && (
                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                  Fundraising Needed
                </span>
              )}
              
              {item.price !== null && (
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {formatPrice(item.price, item.price_currency)}
                  {item.estimated_price && <span className="ml-1">(est.)</span>}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Link
              to={`/inventory/edit/${item.id}`}
              className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
            >
              <Edit className="h-5 w-5" />
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 text-white p-2 rounded hover:bg-red-700"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Status Conversion Button for Needed Supplies */}
        {item.item_type === 'needed_supply' && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-green-800 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Mark as Acquired
                </h3>
                <p className="text-green-700 text-sm mt-1">
                  Have you acquired this item? Convert it from a needed supply to an owned resource.
                </p>
              </div>
              <button
                onClick={handleConvertToOwned}
                disabled={updatingStatus}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-green-300 flex items-center"
              >
                {updatingStatus ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Owned
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Find Purchase Link Button */}
        {!item.product_link && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-blue-800 flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Find Purchase Link
                </h3>
                <p className="text-blue-700 text-sm mt-1">
                  Find where you can buy this item online using Google Search.
                </p>
              </div>
              <button
                onClick={handleFindPurchaseLink}
                disabled={searchingPurchaseLink}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
              >
                {searchingPurchaseLink ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Find Where to Buy
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Estimate Price Button */}
        {item.price === null && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-purple-800 flex items-center">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Estimate Price
                </h3>
                <p className="text-purple-700 text-sm mt-1">
                  Use AI to estimate the price of this item based on similar items and market data.
                </p>
              </div>
              <button
                onClick={handleEstimatePrice}
                disabled={estimatingPrice}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-purple-300 flex items-center"
              >
                {estimatingPrice ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Estimating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Estimate Price
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
        {item.description && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Description</h2>
            <p className="text-gray-600 whitespace-pre-line">{item.description}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Quantity & Details</h2>
            
            <div className="space-y-3">
              {/* Show quantities based on item type */}
              {item.item_type === 'needed_supply' && item.quantity_needed !== null && (
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-yellow-100 rounded-full flex items-center justify-center mr-2 mt-0.5">
                    <span className="text-yellow-800 text-xs font-bold">N</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Quantity Needed</p>
                    <p className="text-gray-700 font-medium">
                      {item.quantity_needed} {item.unit || 'units'}
                    </p>
                  </div>
                </div>
              )}
              
              {item.item_type === 'owned_resource' && item.quantity_owned !== null && (
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center mr-2 mt-0.5">
                    <span className="text-green-800 text-xs font-bold">O</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Quantity Owned</p>
                    <p className="text-gray-700 font-medium">
                      {item.quantity_owned} {item.unit || 'units'}
                    </p>
                  </div>
                </div>
              )}
              
              {item.item_type === 'borrowed_or_rental' && item.quantity_borrowed !== null && (
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 mt-0.5">
                    <span className="text-blue-800 text-xs font-bold">B</span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Quantity Borrowed</p>
                    <p className="text-gray-700 font-medium">
                      {item.quantity_borrowed} {item.unit || 'units'}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Price Information */}
              {item.price !== null && (
                <div className="flex items-start">
                  <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center mr-2 mt-0.5">
                    <DollarSign className="h-4 w-4 text-green-800" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {item.estimated_price ? 'Estimated Price' : 'Price'}
                    </p>
                    <p className="text-gray-700 font-medium">
                      {formatPrice(item.price, item.price_currency)}
                    </p>
                    {item.price_date && (
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        Updated: {new Date(item.price_date).toLocaleDateString()}
                      </p>
                    )}
                    {item.price_source && (
                      <p className="text-xs text-gray-500 mt-1">
                        Source: {item.price_source}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Associations */}
              {projectName && (
                <div className="flex items-start">
                  <Folder className="h-5 w-5 mr-2 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Project</p>
                    <Link 
                      to={`/projects/${item.project_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {projectName}
                    </Link>
                  </div>
                </div>
              )}
              
              {taskName && (
                <div className="flex items-start">
                  <CheckSquare className="h-5 w-5 mr-2 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Task</p>
                    <Link 
                      to={`/tasks/${item.associated_task_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {taskName}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Additional Information</h2>
            
            <div className="space-y-4">
              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag, index) => (
                      <span key={index} className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-sm flex items-center">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Links */}
              <div className="space-y-2">
                {item.product_link && (
                  <div>
                    <p className="text-sm text-gray-500">Purchase Link</p>
                    <a 
                      href={item.product_link}
                      target="_blank"
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline flex items-center"
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Buy Now
                    </a>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {item.product_link}
                    </p>
                  </div>
                )}
                
                {item.info_link && (
                  <div>
                    <p className="text-sm text-gray-500">Information Link</p>
                    <a 
                      href={item.info_link}
                      target="_blank"
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline flex items-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {item.info_link.length > 40 
                        ? `${item.info_link.substring(0, 40)}...` 
                        : item.info_link}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Item Image */}
        {item.image_url && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
              <ImageIcon className="h-5 w-5 mr-2" />
              Item Image
            </h2>
            <div className="flex justify-center">
              <img 
                src={item.image_url} 
                alt={item.title}
                className="max-w-full max-h-[400px] rounded-lg shadow-md object-contain" 
                onError={(e) => {
                  // Hide the image if it fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                  // Show an error message
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    const errorMsg = document.createElement('p');
                    errorMsg.className = 'text-red-500 text-center';
                    errorMsg.textContent = 'Image failed to load';
                    parent.appendChild(errorMsg);
                  }
                }}
              />
            </div>
          </div>
        )}
        
        <div className="flex justify-between mt-8">
          <Link
            to="/inventory"
            className="text-blue-600 hover:underline flex items-center"
          >
            ← Back to Inventory
          </Link>
          
          {item.project_id && (
            <Link
              to={`/projects/${item.project_id}/inventory`}
              className="text-blue-600 hover:underline flex items-center"
            >
              Back to Project Inventory
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryItemDetailView;