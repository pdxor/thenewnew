/*
  # Add price field to items table

  1. Changes
    - Add price field to items table to track item costs
    - Add estimated_price field for items where exact price is unknown
    - Add price_currency field to specify currency
    - Add price_date field to track when price was last updated
    - Add price_source field to track where price information came from
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add price-related fields to items table
ALTER TABLE items
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS estimated_price BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS price_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS price_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS price_source TEXT;

-- Add comment to explain the fields
COMMENT ON COLUMN items.price IS 'The price of the item';
COMMENT ON COLUMN items.estimated_price IS 'Whether the price is estimated or exact';
COMMENT ON COLUMN items.price_currency IS 'The currency of the price (default: USD)';
COMMENT ON COLUMN items.price_date IS 'When the price was last updated';
COMMENT ON COLUMN items.price_source IS 'Where the price information came from (e.g., website, store, AI)';