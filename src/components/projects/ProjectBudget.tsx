import React, { useState, useEffect } from 'react';
import { Database } from '../../types/supabase';
import { supabase } from '../../lib/supabase';
import { 
  DollarSign, 
  PieChart, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  ShoppingCart, 
  Sparkles,
  Loader2,
  Plus,
  Edit,
  Save,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { estimateItemPrice, updateItemPrice } from '../../lib/priceEstimation';
import { useAuth } from '../../context/AuthContext';

type Project = Database['public']['Tables']['projects']['Row'];
type InventoryItem = Database['public']['Tables']['items']['Row'];

interface ProjectBudgetProps {
  project: Project;
  items: InventoryItem[];
}

const ProjectBudget: React.FC<ProjectBudgetProps> = ({ project, items }) => {
  const { user } = useAuth();
  const [budget, setBudget] = useState<number | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudget, setNewBudget] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [estimatingPrice, setEstimatingPrice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Calculate total cost of needed items
  const neededItems = items.filter(item => item.item_type === 'needed_supply');
  const ownedItems = items.filter(item => item.item_type === 'owned_resource');
  const borrowedItems = items.filter(item => item.item_type === 'borrowed_or_rental');
  
  // Calculate totals
  const neededItemsWithPrice = neededItems.filter(item => item.price !== null);
  const neededItemsWithoutPrice = neededItems.filter(item => item.price === null);
  const totalNeededCost = neededItemsWithPrice.reduce((sum, item) => sum + (item.price || 0) * (item.quantity_needed || 1), 0);
  
  const ownedItemsWithPrice = ownedItems.filter(item => item.price !== null);
  const totalOwnedValue = ownedItemsWithPrice.reduce((sum, item) => sum + (item.price || 0) * (item.quantity_owned || 1), 0);
  
  const borrowedItemsWithPrice = borrowedItems.filter(item => item.price !== null);
  const totalBorrowedValue = borrowedItemsWithPrice.reduce((sum, item) => sum + (item.price || 0) * (item.quantity_borrowed || 1), 0);
  
  // Calculate percentages
  const budgetAmount = budget || 0;
  const budgetPercentage = budgetAmount > 0 ? (totalNeededCost / budgetAmount) * 100 : 0;
  const isOverBudget = budgetAmount > 0 && totalNeededCost > budgetAmount;
  
  // Initialize budget from project funding_needs
  useEffect(() => {
    if (project.funding_needs) {
      // Try to parse the funding_needs as a number
      const parsedBudget = parseFloat(project.funding_needs.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedBudget)) {
        setBudget(parsedBudget);
        setNewBudget(parsedBudget.toString());
      }
    }
  }, [project]);
  
  // Save budget to project
  const handleSaveBudget = async () => {
    if (!newBudget.trim()) {
      setEditingBudget(false);
      return;
    }
    
    const parsedBudget = parseFloat(newBudget.replace(/[^0-9.]/g, ''));
    if (isNaN(parsedBudget)) {
      setError('Please enter a valid number for the budget');
      return;
    }
    
    setSavingBudget(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          funding_needs: parsedBudget.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);
        
      if (error) throw error;
      
      setBudget(parsedBudget);
      setEditingBudget(false);
    } catch (err) {
      console.error('Error saving budget:', err);
      setError('Failed to save budget');
    } finally {
      setSavingBudget(false);
    }
  };
  
  // Estimate price for an item
  const handleEstimatePrice = async (item: InventoryItem) => {
    if (!user) return;
    
    setEstimatingPrice(item.id);
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
      
      // Update the item in the local state
      const updatedItem = {
        ...item,
        price: estimate.price,
        estimated_price: true,
        price_currency: estimate.currency,
        price_date: new Date().toISOString(),
        price_source: estimate.source
      };
      
      // Force a page reload to update the budget calculations
      window.location.reload();
      
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
  
  // Format currency
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <DollarSign className="h-6 w-6 mr-2 text-green-600" />
          Project Budget
        </h2>
        
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
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Budget Overview</h3>
            {!editingBudget ? (
              <button
                onClick={() => setEditingBudget(true)}
                className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit Budget
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveBudget}
                  disabled={savingBudget}
                  className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-green-300 text-sm flex items-center"
                >
                  {savingBudget ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </button>
                <button
                  onClick={() => setEditingBudget(false)}
                  className="text-gray-600 hover:text-gray-800 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          
          {!editingBudget ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-500 mb-1">Total Budget</h4>
                <p className="text-2xl font-bold text-gray-800">
                  {budget !== null ? formatCurrency(budget) : 'Not set'}
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-500 mb-1">Needed Supplies Cost</h4>
                <p className="text-2xl font-bold text-gray-800">
                  {formatCurrency(totalNeededCost)}
                </p>
                {neededItemsWithoutPrice.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {neededItemsWithoutPrice.length} items without price
                  </p>
                )}
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-500 mb-1">Budget Status</h4>
                {budget === null ? (
                  <p className="text-lg font-medium text-gray-600">Set a budget to track status</p>
                ) : isOverBudget ? (
                  <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                    <p className="text-lg font-medium text-red-600">
                      Over budget by {formatCurrency(totalNeededCost - budgetAmount)}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <p className="text-lg font-medium text-green-600">
                      Under budget by {formatCurrency(budgetAmount - totalNeededCost)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="budget">
                Project Budget
              </label>
              <div className="flex">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    id="budget"
                    type="text"
                    className="w-full pl-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    placeholder="Enter project budget"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Enter the total budget for this project. This will be used to track spending against your budget.
              </p>
            </div>
          )}
          
          {budget !== null && !editingBudget && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Budget Utilization</h4>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block text-gray-600">
                      {budgetPercentage.toFixed(1)}% Used
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-gray-600">
                      {formatCurrency(totalNeededCost)} of {formatCurrency(budgetAmount)}
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                  <div 
                    style={{ width: `${Math.min(budgetPercentage, 100)}%` }} 
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      isOverBudget ? 'bg-red-500' : budgetPercentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                  ></div>
                </div>
              </div>
              
              {isOverBudget && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                    <div>
                      <h5 className="text-red-800 font-medium">Budget Warning</h5>
                      <p className="text-red-700 text-sm">
                        Your needed supplies cost exceeds your budget by {formatCurrency(totalNeededCost - budgetAmount)}.
                        Consider adjusting your budget or reducing costs.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Inventory Items with Prices */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <Package className="h-5 w-5 mr-2 text-yellow-600" />
            Needed Supplies
            <span className="ml-2 text-sm text-gray-500">
              ({neededItems.length} items, {neededItemsWithPrice.length} with prices)
            </span>
          </h3>
          
          {neededItems.length === 0 ? (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600 mb-4">No needed supplies have been added to this project yet.</p>
              <Link
                to={`/inventory/new?project_id=${project.id}`}
                className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
              >
                <Plus className="h-5 w-5 mr-1" />
                Add Needed Supply
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {neededItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <Link to={`/inventory/${item.id}`} className="text-blue-600 hover:underline">
                            {item.title}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          {item.quantity_needed || 1} {item.unit || 'units'}
                        </td>
                        <td className="py-3 px-4">
                          {item.price !== null ? (
                            <span className="font-medium">
                              {formatCurrency(item.price, item.price_currency)}
                              {item.estimated_price && <span className="text-xs text-gray-500 ml-1">(est.)</span>}
                            </span>
                          ) : (
                            <span className="text-gray-400">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {item.price !== null ? (
                            <span className="font-medium">
                              {formatCurrency((item.price || 0) * (item.quantity_needed || 1), item.price_currency)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {item.price === null && (
                            <button
                              onClick={() => handleEstimatePrice(item)}
                              disabled={estimatingPrice === item.id}
                              className="text-purple-600 hover:text-purple-800 text-sm flex items-center"
                            >
                              {estimatingPrice === item.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 mr-1" />
                              )}
                              Estimate Price
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    
                    {/* Total row */}
                    <tr className="bg-gray-50 font-medium">
                      <td className="py-3 px-4" colSpan={3}>Total Needed Supplies Cost</td>
                      <td className="py-3 px-4 font-bold text-green-700">{formatCurrency(totalNeededCost)}</td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {neededItemsWithoutPrice.length > 0 && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                    <div>
                      <h5 className="text-yellow-800 font-medium">Missing Prices</h5>
                      <p className="text-yellow-700 text-sm">
                        {neededItemsWithoutPrice.length} items don't have prices set. 
                        Use the "Estimate Price" button to get AI-generated price estimates.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Owned Resources */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <Package className="h-5 w-5 mr-2 text-green-600" />
            Owned Resources
            <span className="ml-2 text-sm text-gray-500">
              ({ownedItems.length} items, {ownedItemsWithPrice.length} with prices)
            </span>
          </h3>
          
          {ownedItems.length === 0 ? (
            <div className="bg-gray-50 p-6 rounded-lg text-center">
              <p className="text-gray-600">No owned resources have been added to this project yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Value</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ownedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link to={`/inventory/${item.id}`} className="text-blue-600 hover:underline">
                          {item.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        {item.quantity_owned || 1} {item.unit || 'units'}
                      </td>
                      <td className="py-3 px-4">
                        {item.price !== null ? (
                          <span className="font-medium">
                            {formatCurrency(item.price, item.price_currency)}
                            {item.estimated_price && <span className="text-xs text-gray-500 ml-1">(est.)</span>}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.price !== null ? (
                          <span className="font-medium">
                            {formatCurrency((item.price || 0) * (item.quantity_owned || 1), item.price_currency)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Total row */}
                  <tr className="bg-gray-50 font-medium">
                    <td className="py-3 px-4" colSpan={3}>Total Owned Resources Value</td>
                    <td className="py-3 px-4 font-bold text-green-700">{formatCurrency(totalOwnedValue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Budget Summary */}
        {budget !== null && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-blue-600" />
              Budget Summary
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Budget Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Budget:</span>
                    <span className="font-medium">{formatCurrency(budgetAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Needed Supplies Cost:</span>
                    <span className="font-medium">{formatCurrency(totalNeededCost)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Owned Resources Value:</span>
                    <span className="font-medium">{formatCurrency(totalOwnedValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Borrowed Items Value:</span>
                    <span className="font-medium">{formatCurrency(totalBorrowedValue)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <div className="flex justify-between items-center font-medium">
                      <span className={isOverBudget ? 'text-red-600' : 'text-green-600'}>
                        {isOverBudget ? 'Budget Deficit:' : 'Budget Surplus:'}
                      </span>
                      <span className={isOverBudget ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(Math.abs(budgetAmount - totalNeededCost))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Budget Status</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {isOverBudget ? (
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                      <div>
                        <h5 className="text-red-800 font-medium">Over Budget</h5>
                        <p className="text-red-700 text-sm mb-2">
                          Your project is over budget by {formatCurrency(totalNeededCost - budgetAmount)}.
                        </p>
                        <p className="text-red-700 text-sm">
                          Consider increasing your budget or reducing costs by removing some items.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                      <div>
                        <h5 className="text-green-800 font-medium">Under Budget</h5>
                        <p className="text-green-700 text-sm">
                          Your project is under budget by {formatCurrency(budgetAmount - totalNeededCost)}.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Fundraising Needs */}
                {isOverBudget && (
                  <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h5 className="text-yellow-800 font-medium flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      Fundraising Needed
                    </h5>
                    <div className="mt-2">
                      <div className="flex justify-between mb-1 text-sm">
                        <span>Progress</span>
                        <span>{((budgetAmount / totalNeededCost) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-yellow-600 h-2.5 rounded-full" 
                          style={{ width: `${Math.min((budgetAmount / totalNeededCost) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-yellow-700 text-sm mt-2">
                        You need to raise an additional {formatCurrency(totalNeededCost - budgetAmount)} to fully fund this project.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Add Items CTA */}
        <div className="flex justify-center mt-8">
          <Link
            to={`/inventory/new?project_id=${project.id}`}
            className="bg-green-600 text-white py-2 px-6 rounded-md hover:bg-green-700 flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New Inventory Item
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProjectBudget;