/*
  # Fix infinite recursion in projects table policy
  
  1. Changes
     - Drop the problematic "Users can view projects fixed" policy
     - Create a new policy with optimized conditions to prevent infinite recursion
     
  2. Security
     - Maintains the same access control logic, but with better implementation
     - Users can still only view projects they created or are members of
*/

-- Drop the problematic policy that's causing infinite recursion
DROP POLICY IF EXISTS "Users can view projects fixed" ON projects;

-- Create a new policy without the recursive structure
CREATE POLICY "Users can view projects" ON projects
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    id IN (
      SELECT project_id 
      FROM project_members 
      WHERE user_id = auth.uid() AND invitation_status = 'accepted'::invitation_status
    )
  );