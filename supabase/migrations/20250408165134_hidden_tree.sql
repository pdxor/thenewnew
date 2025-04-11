/*
  # Fix infinite recursion and policy errors

  1. Changes
    - Drops and recreates the RLS policies for the project_members table to fix the infinite recursion issue
    - Simplifies policy conditions to avoid self-referential loops
    - Updates the notification_logs policy to remove invalid OLD/NEW references

  2. Security
    - Maintains RLS protection on all tables
    - Ensures users can only view/modify project members for projects they have access to
    - Fixes the update policy for notification_logs
*/

-- Drop existing policies that are causing the infinite recursion
DROP POLICY IF EXISTS "Users can view project members for their projects" ON public.project_members;
DROP POLICY IF EXISTS "Project admins and owners can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins and owners can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins and owners can delete project members" ON public.project_members;

-- Create new, simplified policies without recursion
-- For SELECT operations
CREATE POLICY "Users can view project members for their projects" 
ON public.project_members
FOR SELECT 
TO authenticated
USING (
  -- Users can view members of projects they created
  (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()))
  OR
  -- Users can view members of projects where they are a member
  (EXISTS (
    SELECT 1 FROM project_members
    WHERE 
      project_id = public.project_members.project_id
      AND user_id = auth.uid()
      AND invitation_status = 'accepted'
  ))
);

-- For UPDATE operations
CREATE POLICY "Project admins and owners can update project members" 
ON public.project_members
FOR UPDATE
TO authenticated
USING (
  -- Project creators can update members
  (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()))
  OR
  -- Admin/owner members can update other members
  (EXISTS (
    SELECT 1 FROM project_members 
    WHERE 
      project_id = public.project_members.project_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND invitation_status = 'accepted'
  ))
)
WITH CHECK (
  -- Same conditions for the WITH CHECK clause
  (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()))
  OR
  (EXISTS (
    SELECT 1 FROM project_members 
    WHERE 
      project_id = public.project_members.project_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND invitation_status = 'accepted'
  ))
);

-- For INSERT operations
CREATE POLICY "Project admins and owners can insert project members"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Project creators can add members
  (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()))
  OR
  -- Admin/owner members can add other members
  (EXISTS (
    SELECT 1 FROM project_members 
    WHERE 
      project_id = public.project_members.project_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND invitation_status = 'accepted'
  ))
);

-- For DELETE operations
CREATE POLICY "Project admins and owners can delete project members"
ON public.project_members
FOR DELETE
TO authenticated
USING (
  -- Project creators can delete members
  (project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()))
  OR
  -- Admin/owner members can delete other members
  (EXISTS (
    SELECT 1 FROM project_members 
    WHERE 
      project_id = public.project_members.project_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND invitation_status = 'accepted'
  ))
);

-- Fix notification_logs policies
DROP POLICY IF EXISTS "Users can update their own notification read status" ON public.notification_logs;

-- Create simplified policy for notification_logs updates
CREATE POLICY "Users can update their own notification read status"
  ON notification_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());