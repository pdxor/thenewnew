/**
 * Utility functions for filtering and cleaning inventory item titles
 */

/**
 * Removes leading "I" or "i" from titles unless it's part of a product name like "iPod"
 * 
 * @param title The original item title
 * @returns The cleaned title
 */
export function cleanItemTitle(title: string): string {
  if (!title) return title;
  
  // List of product names that legitimately start with "i"
  const validIProducts = [
    'ipod', 'iphone', 'ipad', 'imac', 'itunes', 'iwatch', 'iwallet', 'icloud', 
    'intel', 'ikea', 'ibm', 'irobot', 'isuzu', 'ibanez', 'irobot', 'irobot', 'irobot'
  ];
  
  // Check if the title starts with "I " or "i " (with a space after)
  if (/^[Ii]\s+/.test(title)) {
    // Check if what follows the "I " is a valid product name
    const remainingText = title.substring(2).toLowerCase();
    
    // If it's not a valid i-product, remove the leading "I "
    if (!validIProducts.some(product => remainingText.startsWith(product))) {
      return title.substring(2);
    }
  }
  
  return title;
}