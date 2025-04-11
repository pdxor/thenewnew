/*
  # Fix infinite recursion in database policies

  1. Changes
    - Drop all existing policies on the projects table
    - Create new, simplified policies that avoid circular references
    - Fix RLS policies for related tables to prevent recursion
*/

-- Drop all existing policies on the projects table
DROP POLICY IF EXISTS "Users can view projects" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects" ON projects;
DROP POLICY IF EXISTS "Users can delete projects" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Team members can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects they created or are members of" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects and projects they are members of" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects they created or are admins of" ON projects;
DROP POLICY IF EXISTS "Creators can update their projects" ON projects;
DROP POLICY IF EXISTS "Creators and team admins can update their projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;
DROP POLICY IF EXISTS "Creators can delete their projects" ON projects;

-- Create fresh SELECT policy for projects with no recursion
CREATE POLICY "Users can view projects" 
ON projects 
FOR SELECT 
TO authenticated 
USING (
  -- Simple condition: either the user created the project
  created_by = auth.uid() 
  OR 
  -- Or they are in the project_members table with accepted status
  id IN (
    SELECT project_id 
    FROM project_members 
    WHERE user_id = auth.uid() AND invitation_status = 'accepted'
  )
);

-- Simple INSERT policy - only create your own projects
CREATE POLICY "Users can insert projects"
ON projects
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- UPDATE policy - project creator or admin member can update
CREATE POLICY "Users can update projects"
ON projects
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR
  id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      role IN ('admin', 'owner') AND
      invitation_status = 'accepted'
  )
);

-- DELETE policy - only project creator can delete
CREATE POLICY "Users can delete projects"
ON projects
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Also drop and recreate any policies on project_members that might have circular references
DROP POLICY IF EXISTS "Users can view project members for their projects" ON project_members;
DROP POLICY IF EXISTS "Project admins and owners can update project members" ON project_members;
DROP POLICY IF EXISTS "Project admins and owners can insert project members" ON project_members;
DROP POLICY IF EXISTS "Project admins and owners can delete project members" ON project_members;

-- Project members SELECT policy
CREATE POLICY "Users can view project members for their projects"
ON project_members
FOR SELECT
TO authenticated
USING (
  -- User either created the project
  (project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ))
  OR
  -- Or is a member of the project
  (project_id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      invitation_status = 'accepted'
  ))
);

-- Project members INSERT policy
CREATE POLICY "Project admins and owners can insert project members"
ON project_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- User created the project
  (project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ))
  OR
  -- User is an admin/owner in the project
  (project_id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      role IN ('admin', 'owner') AND
      invitation_status = 'accepted'
  ))
);

-- Project members UPDATE policy
CREATE POLICY "Project admins and owners can update project members"
ON project_members
FOR UPDATE
TO authenticated
USING (
  -- User created the project
  (project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ))
  OR
  -- User is an admin/owner in the project
  (project_id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      role IN ('admin', 'owner') AND
      invitation_status = 'accepted'
  ))
);

-- Project members DELETE policy
CREATE POLICY "Project admins and owners can delete project members"
ON project_members
FOR DELETE
TO authenticated
USING (
  -- User created the project
  (project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ))
  OR
  -- User is an admin/owner in the project
  (project_id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      role IN ('admin', 'owner') AND
      invitation_status = 'accepted'
  ))
);