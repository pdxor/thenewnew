import React from 'react';
import { Database } from '../../types/supabase';
import { Package, Tag, Folder, CheckSquare, CheckCircle, DollarSign, ExternalLink } from 'lucide-react';

type InventoryItem = Database['public']['Tables']['items']['Row'];

interface InventoryItemCardProps {
  item: InventoryItem & { 
    projects?: { title: string } | null;
    tasks?: { title: string } | null;
  };
}

const InventoryItemCard: React.FC<InventoryItemCardProps> = ({ item }) => {
  // Get item type badge color
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

  // Format price with currency symbol
  const formatPrice = (price: number | null, currency: string = 'USD') => {
    if (price === null) return null;
    
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow h-full flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-800 line-clamp-2">{item.title}</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getItemTypeColor(item.item_type)}`}>
          {formatItemType(item.item_type)}
        </span>
      </div>
      
      {/* Image display */}
      {item.image_url && (
        <div className="mb-3 flex justify-center">
          <img 
            src={item.image_url} 
            alt={item.title} 
            className="h-32 object-contain rounded-md"
            onError={(e) => {
              // Hide the image if it fails to load
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      
      {item.description && (
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
      )}
      
      {/* Show price if available */}
      {item.price !== null && (
        <div className="text-sm text-green-700 flex items-center mb-2">
          <DollarSign className="h-3 w-3 mr-1" />
          <span className="font-medium">
            {formatPrice(item.price, item.price_currency)}
            {item.estimated_price && <span className="text-xs ml-1">(est.)</span>}
          </span>
        </div>
      )}
      
      {/* Purchase link */}
      {item.product_link && (
        <div className="text-sm text-blue-600 flex items-center mb-2">
          <ExternalLink className="h-3 w-3 mr-1" />
          <a 
            href={item.product_link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            Buy Now
          </a>
        </div>
      )}
      
      {/* Show quantities based on item type */}
      <div className="mb-3">
        {item.item_type === 'needed_supply' && item.quantity_needed !== null && (
          <div className="text-sm text-yellow-700">
            <span className="font-medium">Needed:</span> {item.quantity_needed} {item.unit || 'units'}
          </div>
        )}
        
        {item.item_type === 'owned_resource' && item.quantity_owned !== null && (
          <div className="text-sm text-green-700 flex items-center">
            <CheckCircle className="h-3 w-3 mr-1" />
            <span className="font-medium">Owned:</span> {item.quantity_owned} {item.unit || 'units'}
          </div>
        )}
        
        {item.item_type === 'borrowed_or_rental' && item.quantity_borrowed !== null && (
          <div className="text-sm text-blue-700">
            <span className="font-medium">Borrowed:</span> {item.quantity_borrowed} {item.unit || 'units'}
          </div>
        )}
      </div>
      
      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {item.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full flex items-center">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              +{item.tags.length - 3} more
            </span>
          )}
        </div>
      )}
      
      {/* Associations */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-auto">
        {item.project_id && item.projects && (
          <div className="flex items-center">
            <Folder className="h-3 w-3 mr-1" />
            {item.projects.title}
          </div>
        )}
        
        {item.associated_task_id && item.tasks && (
          <div className="flex items-center">
            <CheckSquare className="h-3 w-3 mr-1" />
            {item.tasks.title}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryItemCard;