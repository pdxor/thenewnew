/*
  # Fix current_projects column issue

  1. Changes
     - Adds a migration to handle the current_projects column issue
     - Ensures profiles can be properly queried by the MemberBoard component
     - Adds proper indexing for email searches

  2. Security
     - Maintains existing RLS policies
     - Ensures profiles can be viewed by authenticated users
*/

-- First check if the current_projects column exists, if not, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'current_projects'
  ) THEN
    -- Add the current_projects column as a UUID array
    ALTER TABLE public.profiles ADD COLUMN current_projects UUID[] DEFAULT NULL;
  END IF;
END $$;

-- Add index on email column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'profiles' AND indexname = 'profiles_email_search_idx'
  ) THEN
    CREATE INDEX profiles_email_search_idx ON public.profiles (email);
  END IF;
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