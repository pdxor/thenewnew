/*
  # Fix registration flow and data migration

  1. Changes
    - Drop the users table if it exists (since we're using auth.users)
    - Update foreign key constraints to reference auth.users correctly
    - Add trigger to create profile on user signup
    - Add migration for existing data
*/

-- Drop the users table if it exists (since we're using auth.users)
DROP TABLE IF EXISTS users CASCADE;

-- Ensure profiles table has correct foreign key to auth.users
ALTER TABLE IF EXISTS profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey,
  ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Create trigger to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, joined_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing profiles to ensure they have correct user_id references
DO $$
BEGIN
  -- Update any profiles that might have incorrect user_id references
  UPDATE profiles p
  SET user_id = u.id
  FROM auth.users u
  WHERE p.email = u.email
  AND p.user_id != u.id;
  
  -- Clean up any orphaned profiles
  DELETE FROM profiles
  WHERE user_id NOT IN (SELECT id FROM auth.users);
END $$;