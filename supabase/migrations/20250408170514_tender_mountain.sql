/*
  # Fix infinite recursion in projects table policies

  1. Changes
    - Drop ALL existing policies on projects table to start with a clean slate
    - Create new, simplified policies that prevent circular dependencies
    - Ensure RLS works correctly for creators and team members
*/

-- First, drop all existing policies on projects table
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Team members can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they created or are members of" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects and projects they are members of" ON projects;
DROP POLICY IF EXISTS "Users can view projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects they created or are admins of" ON projects;
DROP POLICY IF EXISTS "Creators can update their projects" ON projects;
DROP POLICY IF EXISTS "Creators and team admins can update their projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;
DROP POLICY IF EXISTS "Creators can delete their projects" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;

-- Create fresh policies that avoid recursion

-- SELECT policy - View projects where user is creator or accepted member
CREATE POLICY "Users can view projects"
ON projects
FOR SELECT 
TO authenticated
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM project_members
    WHERE 
      project_members.project_id = projects.id AND 
      project_members.user_id = auth.uid() AND 
      project_members.invitation_status = 'accepted'
  )
);

-- INSERT policy - Only allow users to create their own projects
CREATE POLICY "Users can insert projects"
ON projects
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- UPDATE policy - Allow creators and admins to update
CREATE POLICY "Users can update projects"
ON projects
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM project_members
    WHERE 
      project_members.project_id = projects.id AND
      project_members.user_id = auth.uid() AND
      project_members.role IN ('admin', 'owner') AND
      project_members.invitation_status = 'accepted'
  )
);

-- DELETE policy - Only creators can delete projects
CREATE POLICY "Users can delete projects"
ON projects
FOR DELETE
TO authenticated
USING (created_by = auth.uid());