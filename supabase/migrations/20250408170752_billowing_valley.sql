/*
  # Fix infinite recursion in projects table policy

  1. Changes
     - Drop the existing SELECT policy for projects table
     - Create a new SELECT policy that avoids recursion

  2. Security
     - Maintain same security level for project access
     - Users can still view projects they created or are invited to
*/

-- First, drop the policy causing the recursion
DROP POLICY IF EXISTS "Users can view projects" ON projects;

-- Create a new policy without the recursion issue
CREATE POLICY "Users can view projects fixed" 
ON projects 
FOR SELECT 
TO authenticated 
USING (
  (created_by = auth.uid()) OR 
  (id IN (
    SELECT project_id 
    FROM project_members 
    WHERE 
      user_id = auth.uid() AND 
      invitation_status = 'accepted'
  ))
);