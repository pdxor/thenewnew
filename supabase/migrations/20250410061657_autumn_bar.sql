/*
  # Fix Member Search Functionality

  1. New Functions
    - Ensure proper search functionality for profiles
    - Add index on email column for faster searches
  
  2. Security
    - Ensure proper RLS policies for profiles table
*/

-- Add index on email column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'profiles' AND indexname = 'profiles_email_search_idx'
  ) THEN
    CREATE INDEX profiles_email_search_idx ON public.profiles USING gin (email gin_trgm_ops);
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- If gin_trgm_ops extension is not available, create a basic index
  CREATE INDEX IF NOT EXISTS profiles_email_search_idx ON public.profiles (email);
END $$;

-- Ensure the profiles table has proper RLS policies
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Check if the policy exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Users can view all profiles'
  ) THEN
    CREATE POLICY "Users can view all profiles" 
    ON public.profiles 
    FOR SELECT 
    TO authenticated 
    USING (true);
  END IF;
END $$;