import { supabase } from './supabase';
import { generateWithOpenAI } from './openai';

// Define the structure of a price estimate
export interface PriceEstimate {
  price: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

// Function to estimate price using AI
export async function estimateItemPrice(
  userId: string,
  itemTitle: string,
  itemDescription?: string | null
): Promise<PriceEstimate> {
  try {
    // First check if we have similar items in the database with prices
    const similarItems = await findSimilarItems(itemTitle);
    
    if (similarItems.length > 0) {
      // Calculate average price from similar items
      const totalPrice = similarItems.reduce((sum, item) => sum + (item.price || 0), 0);
      const avgPrice = totalPrice / similarItems.length;
      
      // Use the most common currency
      const currencies = similarItems.map(item => item.price_currency || 'USD');
      const currencyCount: Record<string, number> = {};
      let mostCommonCurrency = 'USD';
      let maxCount = 0;
      
      currencies.forEach(currency => {
        currencyCount[currency] = (currencyCount[currency] || 0) + 1;
        if (currencyCount[currency] > maxCount) {
          maxCount = currencyCount[currency];
          mostCommonCurrency = currency;
        }
      });
      
      return {
        price: parseFloat(avgPrice.toFixed(2)),
        currency: mostCommonCurrency,
        confidence: 'medium',
        source: 'Database average'
      };
    }
    
    // If no similar items found, use AI to estimate price
    const prompt = `I need to estimate the price of the following item:
    
    Item: ${itemTitle}
    ${itemDescription ? `Description: ${itemDescription}` : ''}
    
    Please provide your best estimate of the current market price for this item. 
    Return ONLY a JSON object with the following structure:
    {
      "price": number,
      "currency": "USD",
      "priceRange": "string showing the typical price range",
      "confidence": "high|medium|low",
      "reasoning": "brief explanation of how you arrived at this estimate"
    }
    
    Do not include any other text in your response, just the JSON object.`;
    
    const response = await generateWithOpenAI({
      userId,
      prompt,
      fieldName: 'productSearch',
      maxTokens: 500
    });
    
    try {
      const result = JSON.parse(response);
      
      return {
        price: parseFloat(result.price.toFixed(2)),
        currency: result.currency || 'USD',
        confidence: result.confidence || 'low',
        source: 'AI estimate'
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      
      // Fallback to a simple price extraction if JSON parsing fails
      const priceMatch = response.match(/\$(\d+(?:\.\d{1,2})?)/);
      if (priceMatch && priceMatch[1]) {
        return {
          price: parseFloat(priceMatch[1]),
          currency: 'USD',
          confidence: 'low',
          source: 'AI estimate (fallback)'
        };
      }
      
      // Ultimate fallback
      return {
        price: 0,
        currency: 'USD',
        confidence: 'low',
        source: 'Default estimate'
      };
    }
  } catch (error) {
    console.error('Error estimating price:', error);
    
    // Return a default estimate if all else fails
    return {
      price: 0,
      currency: 'USD',
      confidence: 'low',
      source: 'Default estimate'
    };
  }
}

// Function to find similar items in the database
async function findSimilarItems(itemTitle: string) {
  try {
    // Split the title into words
    const words = itemTitle.toLowerCase().split(/\s+/);
    
    // Filter out common words
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'of', 'for', 'with', 'in', 'on', 'at'];
    const keyWords = words.filter(word => !commonWords.includes(word) && word.length > 2);
    
    if (keyWords.length === 0) {
      return [];
    }
    
    // Create a query to find items with similar titles
    let query = supabase.from('items').select('*').not('price', 'is', null);
    
    // Add conditions for each keyword
    keyWords.forEach(word => {
      query = query.or(`title.ilike.%${word}%`);
    });
    
    const { data, error } = await query.limit(10);
    
    if (error) {
      console.error('Error finding similar items:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in findSimilarItems:', error);
    return [];
  }
}

// Function to update item price in the database
export async function updateItemPrice(
  itemId: string,
  price: number,
  currency: string = 'USD',
  source: string = 'AI estimate'
) {
  try {
    const { error } = await supabase
      .from('items')
      .update({
        price,
        price_currency: currency,
        estimated_price: true,
        price_date: new Date().toISOString(),
        price_source: source
      })
      .eq('id', itemId);
      
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating item price:', error);
    return false;
  }
}