/*
  # Fix projects table infinite recursion

  1. Changes
    - Drops all policies on the projects table that may be causing recursive loops
    - Creates simplified policies that avoid any self-referential or circular references
    - Ensures proper access control between projects and project_members tables

  2. Security
    - Maintains the same access control model
    - Users can still only access projects they created or are members of
    - Simplifies policy expressions to avoid query planner recursion
*/

-- Drop all existing project policies to start fresh
DROP POLICY IF EXISTS "Users can view their own projects and projects they are members of" ON projects;
DROP POLICY IF EXISTS "Creators and team admins can update their projects" ON projects;
DROP POLICY IF EXISTS "Creators can delete their projects" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
DROP POLICY IF EXISTS "Team members can view their projects" ON projects;

-- Create a simpler SELECT policy that avoids recursion
CREATE POLICY "Users can view projects they created or are members of"
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

-- Create a simpler UPDATE policy
CREATE POLICY "Users can update projects they created or are admins of"
ON projects
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() OR
  id IN (
    SELECT project_id 
    FROM project_members 
    WHERE 
      user_id = auth.uid() AND 
      role IN ('admin', 'owner') AND 
      invitation_status = 'accepted'
  )
);

-- Create a simple DELETE policy
CREATE POLICY "Users can delete projects they created"
ON projects
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Create a simple INSERT policy
CREATE POLICY "Users can insert projects"
ON projects
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());