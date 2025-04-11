/*
  # Create profiles table

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users, unique)
      - `name` (text)
      - `email` (text)
      - `short_term_mission` (text)
      - `long_term_mission` (text)
      - `skills` (text array)
      - `location` (text)
      - `avatar_url` (text)
      - `joined_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)
      
  2. Security
    - Enable RLS on `profiles` table
    - Add policies for users to:
      - Select their own profile
      - Insert their own profile
      - Update their own profile
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name text,
  email text,
  short_term_mission text,
  long_term_mission text,
  skills text[] DEFAULT '{}',
  location text,
  avatar_url text,
  joined_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Set up Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create trigger for updating the updated_at column
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profiles_updated_at();

-- Create policies
-- Allow users to view only their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Storage setup for profile avatars (assuming a 'profiles' bucket exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_policies 
    WHERE policyname = 'Enable read access for profile avatars'
  ) THEN
    CREATE POLICY "Enable read access for profile avatars" 
    ON storage.objects 
    FOR SELECT 
    TO authenticated
    USING (bucket_id = 'profiles');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_policies 
    WHERE policyname = 'Enable upload access for profile avatars'
  ) THEN
    CREATE POLICY "Enable upload access for profile avatars" 
    ON storage.objects 
    FOR INSERT 
    TO authenticated
    WITH CHECK (bucket_id = 'profiles' AND (storage.foldername(name))[1] = 'avatars');
  END IF;
END $$;