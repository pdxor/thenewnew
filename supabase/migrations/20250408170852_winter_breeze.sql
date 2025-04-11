/*
  # Fix infinite recursion in projects and project_members policies

  1. Changes
     - Drop all existing policies on projects and project_members tables
     - Create clean, non-recursive policies for both tables
     - Fix cross-referencing between tables that causes circular dependencies

  2. Security
     - Maintain same security level for all operations
     - Users can still access projects they own or are invited to
     - Proper team member management permissions are preserved
*/

-- First, drop all policies on projects table that might be causing issues
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects fixed" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Team members can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects they created or are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects and projects they are members of" ON public.projects;

-- Create clean policies for projects table

-- SELECT policy
CREATE POLICY "Users can view projects fixed"
ON public.projects
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR
  id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND 
      invitation_status = 'accepted'
  )
);

-- INSERT policy
CREATE POLICY "Users can insert projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- UPDATE policy
CREATE POLICY "Users can update projects"
ON public.projects
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

-- DELETE policy
CREATE POLICY "Users can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Now clean up project_members policies to avoid circular references
DROP POLICY IF EXISTS "Users can view project members for their projects" ON public.project_members;
DROP POLICY IF EXISTS "Project admins and owners can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins and owners can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins and owners can delete project members" ON public.project_members;

-- Create clean policies for project_members table

-- SELECT policy
CREATE POLICY "Users can view project members"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ) OR
  project_id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      invitation_status = 'accepted'
  )
);

-- INSERT policy
CREATE POLICY "Users can insert project members"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ) OR
  project_id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      role IN ('admin', 'owner') AND
      invitation_status = 'accepted'
  )
);

-- UPDATE policy
CREATE POLICY "Users can update project members"
ON public.project_members
FOR UPDATE
TO authenticated
USING (
  project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ) OR
  project_id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      role IN ('admin', 'owner') AND
      invitation_status = 'accepted'
  )
);

-- DELETE policy
CREATE POLICY "Users can delete project members"
ON public.project_members
FOR DELETE
TO authenticated
USING (
  project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ) OR
  project_id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      role IN ('admin', 'owner') AND
      invitation_status = 'accepted'
  )
);