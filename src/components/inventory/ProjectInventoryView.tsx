import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Database } from '../../types/supabase';
import { Package, Plus, Filter, ArrowLeft, Folder, Tags, CheckCircle, ShoppingCart, X, DollarSign, Sparkles } from 'lucide-react';
import InventoryItemCard from './InventoryItemCard';
import { searchProductWithGoogle, extractPrice, extractCurrency } from '../../lib/googleSearch';
import { estimateItemPrice, updateItemPrice } from '../../lib/priceEstimation';

type InventoryItem = Database['public']['Tables']['items']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

interface ProductSearchResult {
  title: string;
  description: string;
  price: string | null;
  link: string;
  imageUrl: string | null;
  source: string;
}

const ProjectInventoryView: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [searchingPurchaseLink, setSearchingPurchaseLink] = useState<string | null>(null);
  const [estimatingPrice, setEstimatingPrice] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !user) return;

    const fetchProjectAndItems = async () => {
      try {
        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();
          
        if (projectError) throw projectError;
        
        if (!projectData) {
          setError('Project not found');
          return;
        }
        
        setProject(projectData);
        
        // Fetch inventory items for this project
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('*')
          .eq('project_id', projectId)
          .order('updated_at', { ascending: false });
          
        if (itemsError) throw itemsError;
        
        setItems(itemsData || []);
        
        // Extract all unique tags from items
        const tagsSet = new Set<string>();
        itemsData?.forEach(item => {
          if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => tagsSet.add(tag));
          }
        });
        setAllTags(Array.from(tagsSet).sort());
        
      } catch (err) {
        console.error('Error fetching project inventory:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An error occurred while loading project inventory');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAndItems();
  }, [projectId, user]);

  // Filter items based on selected filters
  const filteredItems = items.filter(item => {
    // Apply type filter
    if (statusFilter !== 'all' && item.item_type !== statusFilter) {
      return false;
    }
    
    // Apply tag filter
    if (tagFilter && (!item.tags || !item.tags.includes(tagFilter))) {
      return false;
    }
    
    return true;
  });

  // Group items by type
  const neededItems = filteredItems.filter(item => item.item_type === 'needed_supply');
  const ownedItems = filteredItems.filter(item => item.item_type === 'owned_resource');
  const borrowedItems = filteredItems.filter(item => item.item_type === 'borrowed_or_rental');

  // Convert needed supply to owned resource
  const handleConvertToOwned = async (item: InventoryItem) => {
    if (!user) return;
    
    setUpdatingItemId(item.id);
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
      setItems(prevItems => 
        prevItems.map(prevItem => 
          prevItem.id === item.id 
            ? {
                ...prevItem,
                item_type: 'owned_resource',
                quantity_owned: prevItem.quantity_needed,
                quantity_needed: 0
              } 
            : prevItem
        )
      );
      
    } catch (err) {
      console.error('Error updating inventory item status:', err);
      setError('Failed to update item status');
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Find purchase link using Google Search API
  const handleFindPurchaseLink = async (item: InventoryItem) => {
    if (!user) return;
    
    setSearchingPurchaseLink(item.id);
    try {
      // Use Google Search API to find product information
      const searchResults = await searchProductWithGoogle(
        user.id,
        item.title,
        3 // Limit to top 3 results
      );
      
      if (searchResults.length === 0) {
        throw new Error(`No search results found for "${item.title}"`);
      }
      
      // Use the first result
      const bestResult = searchResults[0];
      
      // Update the item with the purchase link
      const { error } = await supabase
        .from('items')
        .update({
          product_link: bestResult.link,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);
        
      if (error) throw error;
      
      // Update the local state
      setItems(prevItems => 
        prevItems.map(prevItem => 
          prevItem.id === item.id 
            ? {
                ...prevItem,
                product_link: bestResult.link
              } 
            : prevItem
        )
      );
      
      // If we found a price, update that too
      if (bestResult.price) {
        const price = extractPrice(bestResult.price);
        const currency = extractCurrency(bestResult.price);
        
        if (price !== null) {
          const { error: priceError } = await supabase
            .from('items')
            .update({
              price: price,
              estimated_price: true,
              price_currency: currency,
              price_date: new Date().toISOString(),
              price_source: bestResult.source
            })
            .eq('id', item.id);
            
          if (priceError) console.error('Error updating price:', priceError);
          
          // Update the local state
          setItems(prevItems => 
            prevItems.map(prevItem => 
              prevItem.id === item.id 
                ? {
                    ...prevItem,
                    price: price,
                    estimated_price: true,
                    price_currency: currency,
                    price_date: new Date().toISOString(),
                    price_source: bestResult.source
                  } 
                : prevItem
            )
          );
        }
      }
      
      // If we found an image URL and the item doesn't have one, update that too
      if (bestResult.imageUrl && !item.image_url) {
        const { error: imageError } = await supabase
          .from('items')
          .update({
            image_url: bestResult.imageUrl
          })
          .eq('id', item.id);
          
        if (imageError) console.error('Error updating image URL:', imageError);
        
        // Update the local state
        setItems(prevItems => 
          prevItems.map(prevItem => 
            prevItem.id === item.id 
              ? {
                  ...prevItem,
                  image_url: bestResult.imageUrl
                } 
              : prevItem
          )
        );
      }
      
    } catch (err) {
      console.error('Error finding purchase link:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to find purchase link');
      }
    } finally {
      setSearchingPurchaseLink(null);
    }
  };

  // Estimate price using AI
  const handleEstimatePrice = async (item: InventoryItem) => {
    if (!user) return;
    
    setEstimatingPrice(item.id);
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
      setItems(prevItems => 
        prevItems.map(prevItem => 
          prevItem.id === item.id 
            ? {
                ...prevItem,
                price: estimate.price,
                estimated_price: true,
                price_currency: estimate.currency,
                price_date: new Date().toISOString(),
                price_source: estimate.source
              } 
            : prevItem
        )
      );
      
    } catch (err) {
      console.error('Error estimating price:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to estimate price');
      }
    } finally {
      setEstimatingPrice(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p className="font-bold">Error</p>
        <p>{error || 'Project not found'}</p>
        <div className="mt-4">
          <button
            onClick={() => navigate('/projects')}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Return to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link 
          to={`/projects/${projectId}`}
          className="text-blue-600 hover:underline mb-4 inline-flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Project
        </Link>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-3">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <Folder className="h-6 w-6 mr-2 text-blue-600" />
            {project.title}: Inventory
          </h1>
          
          <div className="flex gap-3">
            {allTags.length > 0 && (
              <div className="relative">
                <Tags className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <select
                  className="pl-9 pr-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none bg-white"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                >
                  <option value="">All Tags</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-3 pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
            
            <div className="relative">
              <Filter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <select
                className="pl-9 pr-8 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Item Types</option>
                <option value="needed_supply">Needed Supplies</option>
                <option value="owned_resource">Owned Resources</option>
                <option value="borrowed_or_rental">Borrowed/Rental Items</option>
              </select>
              <div className="absolute right-3 top-3 pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            <Link
              to={`/inventory/new?project_id=${projectId}`}
              className="flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-1" />
              Add Item
            </Link>
          </div>
        </div>
      </div>
      
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
      
      {items.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No inventory items for this project yet</h2>
          <p className="text-gray-500 mb-6">Start tracking your project resources by adding inventory items</p>
          <Link
            to={`/inventory/new?project_id=${projectId}`}
            className="inline-flex items-center bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors text-lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Inventory Item
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No items match the selected filters</h2>
          <p className="text-gray-500 mb-4">Try selecting a different filter</p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setTagFilter('');
            }}
            className="inline-flex items-center bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Show All Items
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Needed Supplies Section */}
          {neededItems.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                Needed Supplies ({neededItems.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {neededItems.map(item => (
                  <div key={item.id} className="relative group">
                    <Link to={`/inventory/${item.id}`}>
                      <InventoryItemCard item={item} />
                    </Link>
                    <div className="absolute top-2 right-2 flex space-x-1">
                      <button
                        onClick={() => handleConvertToOwned(item)}
                        disabled={updatingItemId === item.id}
                        className="bg-green-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Mark as Owned"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      
                      {!item.product_link && (
                        <button
                          onClick={() => handleFindPurchaseLink(item)}
                          disabled={searchingPurchaseLink === item.id}
                          className="bg-blue-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Find Purchase Link"
                        >
                          {searchingPurchaseLink === item.id ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            <ShoppingCart className="h-5 w-5" />
                          )}
                        </button>
                      )}
                      
                      {item.price === null && (
                        <button
                          onClick={() => handleEstimatePrice(item)}
                          disabled={estimatingPrice === item.id}
                          className="bg-purple-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Estimate Price"
                        >
                          {estimatingPrice === item.id ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            <Sparkles className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Owned Resources Section */}
          {ownedItems.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                Owned Resources ({ownedItems.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedItems.map(item => (
                  <div key={item.id} className="relative group">
                    <Link to={`/inventory/${item.id}`}>
                      <InventoryItemCard item={item} />
                    </Link>
                    <div className="absolute top-2 right-2 flex space-x-1">
                      {!item.product_link && (
                        <button
                          onClick={() => handleFindPurchaseLink(item)}
                          disabled={searchingPurchaseLink === item.id}
                          className="bg-blue-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Find Purchase Link"
                        >
                          {searchingPurchaseLink === item.id ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            <ShoppingCart className="h-5 w-5" />
                          )}
                        </button>
                      )}
                      
                      {item.price === null && (
                        <button
                          onClick={() => handleEstimatePrice(item)}
                          disabled={estimatingPrice === item.id}
                          className="bg-purple-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Estimate Price"
                        >
                          {estimatingPrice === item.id ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            <Sparkles className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Borrowed/Rental Items Section */}
          {borrowedItems.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                Borrowed/Rental Items ({borrowedItems.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {borrowedItems.map(item => (
                  <div key={item.id} className="relative group">
                    <Link to={`/inventory/${item.id}`}>
                      <InventoryItemCard item={item} />
                    </Link>
                    <div className="absolute top-2 right-2 flex space-x-1">
                      {!item.product_link && (
                        <button
                          onClick={() => handleFindPurchaseLink(item)}
                          disabled={searchingPurchaseLink === item.id}
                          className="bg-blue-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Find Purchase Link"
                        >
                          {searchingPurchaseLink === item.id ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            <ShoppingCart className="h-5 w-5" />
                          )}
                        </button>
                      )}
                      
                      {item.price === null && (
                        <button
                          onClick={() => handleEstimatePrice(item)}
                          disabled={estimatingPrice === item.id}
                          className="bg-purple-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Estimate Price"
                        >
                          {estimatingPrice === item.id ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            <Sparkles className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectInventoryView;