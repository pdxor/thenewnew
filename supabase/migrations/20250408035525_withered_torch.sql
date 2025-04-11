/*
  # Create profiles storage bucket

  1. New Storage Bucket
    - `profiles` - For storing user avatar images
  
  2. Security
    - Enable RLS on the bucket
    - Add policies for authenticated users to manage their own files
*/

-- Create the storage bucket for profile avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', false)
ON CONFLICT (id) DO 
  UPDATE SET public = false;

-- Create policy to allow authenticated users to select their own objects
CREATE POLICY select_profile_images
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'profiles' AND (auth.uid() = owner OR owner IS NULL));

-- Create policy to allow authenticated users to insert their own objects
CREATE POLICY insert_profile_images
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profiles' AND auth.uid() = owner);

-- Create policy to allow authenticated users to update their own objects
CREATE POLICY update_profile_images
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'profiles' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'profiles' AND auth.uid() = owner);

-- Create policy to allow authenticated users to delete their own objects
CREATE POLICY delete_profile_images
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'profiles' AND auth.uid() = owner);