/*
  # Fix infinite recursion in projects table policy

  1. Changes
    - Drop the existing SELECT policy for the projects table that's causing recursion
    - Create a new SELECT policy with optimized conditions to prevent recursion
  
  2. Security
    - Maintains same access control intent: users can view their own projects or projects they are members of
    - Avoids recursive policy evaluation by using direct conditions
*/

-- Drop the existing policy causing recursion
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;

-- Create new policy with optimized conditions to prevent recursion
CREATE POLICY "Users can view their own projects" 
ON projects
FOR SELECT 
TO authenticated
USING (
  created_by = auth.uid() OR 
  id IN (
    SELECT project_id 
    FROM project_members 
    WHERE user_id = auth.uid() AND invitation_status = 'accepted'
  )
);