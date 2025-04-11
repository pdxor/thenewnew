/*
  # Storage Policies for Profile Avatars

  1. Storage Configuration
    - Creates the 'profiles' bucket for storing user avatars
    - Sets the bucket to private (public = false)
  
  2. Security Policies
    - Adds row-level security policies for the objects table
    - Ensures users can only access, modify and delete their own files
    - Properly scopes access to the 'profiles' bucket
*/

-- Create the storage bucket for profile avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', false)
ON CONFLICT (id) DO 
  UPDATE SET public = false;

-- Create policies conditionally using PL/pgSQL blocks

-- Policy for selecting profile images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'select_profile_images'
  ) THEN
    CREATE POLICY select_profile_images
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'profiles' AND (auth.uid() = owner OR owner IS NULL));
  END IF;
END $$;

-- Policy for inserting profile images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'insert_profile_images'
  ) THEN
    CREATE POLICY insert_profile_images
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'profiles' AND auth.uid() = owner);
  END IF;
END $$;

-- Policy for updating profile images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'update_profile_images'
  ) THEN
    CREATE POLICY update_profile_images
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'profiles' AND auth.uid() = owner)
    WITH CHECK (bucket_id = 'profiles' AND auth.uid() = owner);
  END IF;
END $$;

-- Policy for deleting profile images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'delete_profile_images'
  ) THEN
    CREATE POLICY delete_profile_images
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'profiles' AND auth.uid() = owner);
  END IF;
END $$;