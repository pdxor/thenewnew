import { supabase } from './supabase';

// Define the structure of a Google search result
interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  pagemap?: {
    cse_thumbnail?: Array<{
      src: string;
      width: string;
      height: string;
    }>;
    cse_image?: Array<{
      src: string;
    }>;
    product?: Array<{
      name: string;
      description: string;
      price?: string;
      image?: string;
    }>;
    offer?: Array<{
      price?: string;
      pricecurrency?: string;
    }>;
    metatags?: Array<{
      'og:price:amount'?: string;
      'og:price:currency'?: string;
      'product:price:amount'?: string;
      'product:price:currency'?: string;
    }>;
  };
}

// Define the structure of a Google search response
interface GoogleSearchResponse {
  items: GoogleSearchResult[];
}

// Define the structure of a product search result
export interface ProductSearchResult {
  title: string;
  description: string;
  price: string | null;
  link: string;
  imageUrl: string | null;
  source: string;
}

// Function to search for products using Google Custom Search API
export async function searchProductWithGoogle(
  userId: string,
  query: string,
  maxResults: number = 5
): Promise<ProductSearchResult[]> {
  try {
    // Get the Google API key from the database
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('key')
      .eq('user_id', userId)
      .eq('service', 'google')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (apiKeyError || !apiKeyData) {
      throw new Error('No Google API key found. Please add your Google API key in settings.');
    }
    
    // Get the Google Custom Search Engine ID from the database
    const { data: cseData, error: cseError } = await supabase
      .from('api_keys')
      .select('key')
      .eq('user_id', userId)
      .eq('service', 'google_cse')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (cseError || !cseData) {
      throw new Error('No Google Custom Search Engine ID found. Please add your Google CSE ID in settings.');
    }
    
    // Construct the search URL
    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
    searchUrl.searchParams.append('key', apiKeyData.key);
    searchUrl.searchParams.append('cx', cseData.key);
    searchUrl.searchParams.append('q', `${query} buy purchase price`);
    searchUrl.searchParams.append('num', maxResults.toString());
    
    // Make the API request
    const response = await fetch(searchUrl.toString());
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json() as GoogleSearchResponse;
    
    if (!data.items || data.items.length === 0) {
      return [];
    }
    
    // Process the search results
    const results: ProductSearchResult[] = data.items.map(item => {
      // Try to extract price from various sources
      let price: string | null = null;
      
      // 1. Check for price in metatags (most reliable)
      if (item.pagemap?.metatags) {
        for (const metatag of item.pagemap.metatags) {
          // Check for Open Graph price tags
          if (metatag['og:price:amount'] && metatag['og:price:currency']) {
            price = `${metatag['og:price:currency']} ${metatag['og:price:amount']}`;
            break;
          }
          
          // Check for Product price tags
          if (metatag['product:price:amount'] && metatag['product:price:currency']) {
            price = `${metatag['product:price:currency']} ${metatag['product:price:amount']}`;
            break;
          }
        }
      }
      
      // 2. Check for price in product data
      if (!price && item.pagemap?.product && item.pagemap.product[0]?.price) {
        price = item.pagemap.product[0].price;
      }
      
      // 3. Check for price in offer data
      if (!price && item.pagemap?.offer && item.pagemap.offer[0]?.price) {
        const currency = item.pagemap.offer[0].pricecurrency || 'USD';
        price = `${currency} ${item.pagemap.offer[0].price}`;
      }
      
      // 4. Check for price in the snippet (less reliable)
      if (!price) {
        // Look for common price patterns in the snippet
        const priceRegex = /\$\d+(\.\d{2})?|\d+(\.\d{2})?\s*(USD|EUR|GBP)/g;
        const priceMatches = item.snippet?.match(priceRegex);
        if (priceMatches && priceMatches.length > 0) {
          // Use the first price found
          price = priceMatches[0];
        }
      }
      
      // 5. Look for price in the title (least reliable)
      if (!price) {
        const titlePriceRegex = /\$\d+(\.\d{2})?|\d+(\.\d{2})?\s*(USD|EUR|GBP)/g;
        const titlePriceMatches = item.title?.match(titlePriceRegex);
        if (titlePriceMatches && titlePriceMatches.length > 0) {
          price = titlePriceMatches[0];
        }
      }
      
      // Get image URL if available
      let imageUrl: string | null = null;
      if (item.pagemap?.cse_image && item.pagemap.cse_image[0]?.src) {
        imageUrl = item.pagemap.cse_image[0].src;
      } else if (item.pagemap?.cse_thumbnail && item.pagemap.cse_thumbnail[0]?.src) {
        imageUrl = item.pagemap.cse_thumbnail[0].src;
      } else if (item.pagemap?.product && item.pagemap.product[0]?.image) {
        imageUrl = item.pagemap.product[0].image;
      }
      
      return {
        title: item.title,
        description: item.snippet || '',
        price,
        link: item.link,
        imageUrl,
        source: item.displayLink
      };
    });
    
    return results;
  } catch (error) {
    console.error('Google search error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to search for products. Please try again later.');
  }
}

// Function to extract price from a string
export function extractPrice(priceString: string | null): number | null {
  if (!priceString) return null;
  
  // Match patterns like $XX.XX, XX.XX USD, USD XX.XX, etc.
  const priceRegex = /(\$|\€|\£|USD|EUR|GBP|CAD|AUD|JPY)?\s*(\d+(?:[.,]\d{1,2})?)\s*(\$|\€|\£|USD|EUR|GBP|CAD|AUD|JPY)?/i;
  const match = priceString.match(priceRegex);
  
  if (match && (match[2])) {
    // Replace comma with dot for European price format
    const normalizedPrice = match[2].replace(',', '.');
    return parseFloat(normalizedPrice);
  }
  
  return null;
}

// Function to extract currency from a string
export function extractCurrency(priceString: string | null): string {
  if (!priceString) return 'USD';
  
  // Check for currency symbols or codes
  if (priceString.includes('$') || priceString.toUpperCase().includes('USD')) {
    return 'USD';
  } else if (priceString.includes('€') || priceString.toUpperCase().includes('EUR')) {
    return 'EUR';
  } else if (priceString.includes('£') || priceString.toUpperCase().includes('GBP')) {
    return 'GBP';
  } else if (priceString.toUpperCase().includes('CAD') || priceString.includes('C$')) {
    return 'CAD';
  } else if (priceString.toUpperCase().includes('AUD') || priceString.includes('A$')) {
    return 'AUD';
  } else if (priceString.includes('¥') || priceString.toUpperCase().includes('JPY')) {
    return 'JPY';
  }
  
  return 'USD';
}