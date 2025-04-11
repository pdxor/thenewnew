/*
  # Fix infinite recursion in projects table policies

  1. Changes
    - Drop the existing policy that's causing the recursive loop
    - Create a new, simplified policy that prevents recursion while maintaining the same access rules
  
  2. Security
    - Maintains same security rules: users can view projects they created or are members of
    - Uses a non-recursive approach for the policy conditions
*/

-- First, drop all existing problematic policies for the projects table
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Team members can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they created or are members of" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects and projects they are members of" ON projects;

-- Create a new, simplified policy that prevents recursion
CREATE POLICY "Users can view projects"
ON projects
FOR SELECT 
TO authenticated
USING (
  -- Either the user is the creator of the project
  created_by = auth.uid()
  OR
  -- Or they are a member via the project_members table
  id IN (
    SELECT project_id 
    FROM project_members 
    WHERE 
      user_id = auth.uid() AND 
      invitation_status = 'accepted'
  )
);