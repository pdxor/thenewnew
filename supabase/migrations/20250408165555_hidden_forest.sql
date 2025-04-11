/*
  # Fix for project_members policies

  1. Changes
     - Replace uid() with auth.uid() in all policies
     - Fix recursive policies that were causing infinite recursion errors
     - Create proper RLS policies for project_members table
*/

-- Drop existing policies that are causing the infinite recursion
DROP POLICY IF EXISTS "Project admins and owners can delete project members" ON project_members;
DROP POLICY IF EXISTS "Project admins and owners can insert project members" ON project_members;
DROP POLICY IF EXISTS "Project admins and owners can update project members" ON project_members;
DROP POLICY IF EXISTS "Users can view project members for their projects" ON project_members;

-- Create corrected policies with auth.uid() instead of uid()
CREATE POLICY "Project admins and owners can delete project members"
ON project_members
FOR DELETE
TO authenticated
USING (
  -- Project creators can delete members
  (project_id IN (SELECT id FROM projects WHERE projects.created_by = auth.uid()))
  OR
  -- Admin/owner members can delete other members
  (EXISTS (
    SELECT 1 FROM project_members AS pm
    WHERE 
      pm.project_id = project_members.project_id AND
      pm.user_id = auth.uid() AND
      pm.role IN ('admin', 'owner') AND
      pm.invitation_status = 'accepted'
  ))
);

CREATE POLICY "Project admins and owners can insert project members"
ON project_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Project creators can add members
  (project_id IN (SELECT id FROM projects WHERE projects.created_by = auth.uid()))
  OR
  -- Admin/owner members can add other members
  (EXISTS (
    SELECT 1 FROM project_members AS pm
    WHERE 
      pm.project_id = project_members.project_id AND
      pm.user_id = auth.uid() AND
      pm.role IN ('admin', 'owner') AND
      pm.invitation_status = 'accepted'
  ))
);

CREATE POLICY "Project admins and owners can update project members"
ON project_members
FOR UPDATE
TO authenticated
USING (
  -- Project creators can update members
  (project_id IN (SELECT id FROM projects WHERE projects.created_by = auth.uid()))
  OR
  -- Admin/owner members can update other members
  (EXISTS (
    SELECT 1 FROM project_members AS pm
    WHERE 
      pm.project_id = project_members.project_id AND
      pm.user_id = auth.uid() AND
      pm.role IN ('admin', 'owner') AND
      pm.invitation_status = 'accepted'
  ))
)
WITH CHECK (
  -- Same conditions for the WITH CHECK clause
  (project_id IN (SELECT id FROM projects WHERE projects.created_by = auth.uid()))
  OR
  (EXISTS (
    SELECT 1 FROM project_members AS pm
    WHERE 
      pm.project_id = project_members.project_id AND
      pm.user_id = auth.uid() AND
      pm.role IN ('admin', 'owner') AND
      pm.invitation_status = 'accepted'
  ))
);

CREATE POLICY "Users can view project members for their projects"
ON project_members
FOR SELECT
TO authenticated
USING (
  -- Users can view members of projects they created
  (project_id IN (SELECT id FROM projects WHERE projects.created_by = auth.uid()))
  OR
  -- Users can view members of projects where they are a member
  (EXISTS (
    SELECT 1 FROM project_members AS pm
    WHERE 
      pm.project_id = project_members.project_id AND
      pm.user_id = auth.uid() AND
      pm.invitation_status = 'accepted'
  ))
);

-- Also fix the project policies to avoid recursion
DROP POLICY IF EXISTS "Users can view projects they created or are members of" ON projects;
DROP POLICY IF EXISTS "Team members can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects they created or are admins of" ON projects;
DROP POLICY IF EXISTS "Users can delete projects they created" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;

-- Creating simpler policies for projects table
CREATE POLICY "Users can view their own projects"
ON projects
FOR SELECT
TO authenticated
USING (
  -- User is the creator
  created_by = auth.uid()
  OR
  -- User is a member
  id IN (
    SELECT project_id FROM project_members
    WHERE 
      user_id = auth.uid() AND 
      invitation_status = 'accepted'
  )
);

CREATE POLICY "Users can update their own projects"
ON projects
FOR UPDATE
TO authenticated
USING (
  -- User is the creator
  created_by = auth.uid()
  OR
  -- User is an admin/owner
  id IN (
    SELECT project_id FROM project_members
    WHERE 
      user_id = auth.uid() AND 
      role IN ('admin', 'owner') AND
      invitation_status = 'accepted'
  )
);

CREATE POLICY "Users can delete their own projects"
ON projects
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can insert projects"
ON projects
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());