/*
  # Add support for Google API keys

  1. Changes
    - Ensure api_keys table supports Google API keys and Google CSE IDs
    - Add policies for users to manage their Google API keys
*/

-- No schema changes needed as the api_keys table already supports multiple services
-- Just add a comment to document the supported services

COMMENT ON TABLE api_keys IS 'Stores API keys for various services including OpenAI, Google, and Google CSE';

-- Ensure policies exist for Google API keys
DO $$
BEGIN
  -- Check if policies exist and create them if they don't
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'api_keys' 
    AND policyname = 'Users can view their own API keys'
  ) THEN
    CREATE POLICY "Users can view their own API keys"
      ON api_keys
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'api_keys' 
    AND policyname = 'Users can insert their own API keys'
  ) THEN
    CREATE POLICY "Users can insert their own API keys"
      ON api_keys
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'api_keys' 
    AND policyname = 'Users can update their own API keys'
  ) THEN
    CREATE POLICY "Users can update their own API keys"
      ON api_keys
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'api_keys' 
    AND policyname = 'Users can delete their own API keys'
  ) THEN
    CREATE POLICY "Users can delete their own API keys"
      ON api_keys
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;