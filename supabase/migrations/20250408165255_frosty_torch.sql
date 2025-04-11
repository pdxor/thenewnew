/*
  # Fix projects table infinite recursion

  1. Changes
    - Drops and recreates the row level security (RLS) policies for the projects table
    - Prevents infinite recursion by simplifying the policies
    - Fixes the team member access logic to avoid self-referential loops

  2. Security
    - Maintains the same access control but with simplified query structure
    - Ensures users can only access projects they created or are invited to
    - Preserves existing permissions model
*/

-- First, drop the existing policy that's causing the infinite recursion
DROP POLICY IF EXISTS "Team members can view their projects" ON projects;

-- Creating a new SELECT policy for projects without recursive references
CREATE POLICY "Users can view their own projects and projects they are members of"
ON projects
FOR SELECT
TO authenticated
USING (
  -- User is the creator of the project
  created_by = auth.uid()
  OR
  -- Or user is a member of the project via project_members table
  id IN (
    SELECT project_id FROM project_members
    WHERE 
      user_id = auth.uid() 
      AND invitation_status = 'accepted'
  )
);

-- Update all other project policies to ensure they don't have recursion issues

-- Projects UPDATE policy
DROP POLICY IF EXISTS "Creators can update their projects" ON projects;
CREATE POLICY "Creators and team admins can update their projects"
ON projects
FOR UPDATE
TO authenticated
USING (
  -- User is the creator of the project
  created_by = auth.uid()
  OR 
  -- Or user is an admin or owner in the project
  id IN (
    SELECT project_id FROM project_members
    WHERE 
      user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND invitation_status = 'accepted'
  )
);

-- Projects DELETE policy
DROP POLICY IF EXISTS "Creators can delete their projects" ON projects;
CREATE POLICY "Creators can delete their projects"
ON projects
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Projects INSERT policy - this should be simple enough already, but let's ensure it's correct
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
CREATE POLICY "Users can insert projects"
ON projects
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());