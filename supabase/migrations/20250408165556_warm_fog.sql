/*
  # Fix infinite recursion in project_members policies

  1. Changes
     - Fix recursive policies in project_members table
     - Update the EXISTS clause in all policies to correctly reference the outer table
     - Change `project_members_1.project_id = project_members_1.project_id` to `project_members_1.project_id = project_members.project_id`
     - Replace all instances of `uid()` with the correct `auth.uid()` function
     
  2. Why the change is needed
     - Current policies contain a self-reference that causes infinite recursion
     - Previous migration failed because uid() function does not exist - it should be auth.uid()
     - This prevents users from accessing projects, resulting in 500 errors
*/

-- First, drop all the existing policies for project_members
DROP POLICY IF EXISTS "Project admins and owners can delete project members" ON project_members;
DROP POLICY IF EXISTS "Project admins and owners can insert project members" ON project_members;
DROP POLICY IF EXISTS "Project admins and owners can update project members" ON project_members;
DROP POLICY IF EXISTS "Users can view project members for their projects" ON project_members;

-- Create corrected policies that don't cause recursion
CREATE POLICY "Project admins and owners can delete project members"
ON project_members
FOR DELETE
TO authenticated
USING (
  (project_id IN (
    SELECT projects.id
    FROM projects
    WHERE projects.created_by = auth.uid()
  )) OR (
    EXISTS (
      SELECT 1
      FROM project_members project_members_1
      WHERE 
        project_members_1.project_id = project_members.project_id AND 
        project_members_1.user_id = auth.uid() AND 
        project_members_1.role IN ('admin', 'owner') AND 
        project_members_1.invitation_status = 'accepted'
    )
  )
);

CREATE POLICY "Project admins and owners can insert project members"
ON project_members
FOR INSERT
TO authenticated
WITH CHECK (
  (project_id IN (
    SELECT projects.id
    FROM projects
    WHERE projects.created_by = auth.uid()
  )) OR (
    EXISTS (
      SELECT 1
      FROM project_members project_members_1
      WHERE 
        project_members_1.project_id = project_members.project_id AND 
        project_members_1.user_id = auth.uid() AND 
        project_members_1.role IN ('admin', 'owner') AND 
        project_members_1.invitation_status = 'accepted'
    )
  )
);

CREATE POLICY "Project admins and owners can update project members"
ON project_members
FOR UPDATE
TO authenticated
USING (
  (project_id IN (
    SELECT projects.id
    FROM projects
    WHERE projects.created_by = auth.uid()
  )) OR (
    EXISTS (
      SELECT 1
      FROM project_members project_members_1
      WHERE 
        project_members_1.project_id = project_members.project_id AND 
        project_members_1.user_id = auth.uid() AND 
        project_members_1.role IN ('admin', 'owner') AND 
        project_members_1.invitation_status = 'accepted'
    )
  )
)
WITH CHECK (
  (project_id IN (
    SELECT projects.id
    FROM projects
    WHERE projects.created_by = auth.uid()
  )) OR (
    EXISTS (
      SELECT 1
      FROM project_members project_members_1
      WHERE 
        project_members_1.project_id = project_members.project_id AND 
        project_members_1.user_id = auth.uid() AND 
        project_members_1.role IN ('admin', 'owner') AND 
        project_members_1.invitation_status = 'accepted'
    )
  )
);

CREATE POLICY "Users can view project members for their projects"
ON project_members
FOR SELECT
TO authenticated
USING (
  (project_id IN (
    SELECT projects.id
    FROM projects
    WHERE projects.created_by = auth.uid()
  )) OR (
    EXISTS (
      SELECT 1
      FROM project_members project_members_1
      WHERE 
        project_members_1.project_id = project_members.project_id AND 
        project_members_1.user_id = auth.uid() AND 
        project_members_1.invitation_status = 'accepted'
    )
  )
);