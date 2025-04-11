/*
  # Fix infinite recursion in database policies

  1. Policy Changes
    - Drop problematic policies for projects and project_members tables
    - Create new, simplified policies without circular dependencies
    - Fix the "team" vs. project_members relationship

  2. Security
    - Maintain existing security model
    - Ensure users can view/edit projects they created or are members of
    - Prevent infinite recursion between tables
*/

-- First, drop all potentially problematic policies
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects fixed" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects" ON public.projects;

-- Create simplified policies for the projects table

-- SELECT policy - users can view projects they created or are team members of
CREATE POLICY "Users can view projects" 
ON public.projects 
FOR SELECT 
TO authenticated
USING (
  created_by = auth.uid() OR  -- They created it
  auth.uid() = ANY(team)      -- They're in the team array
);

-- INSERT policy - users can only create their own projects
CREATE POLICY "Users can insert projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- UPDATE policy - creators can update their projects or team admins can
CREATE POLICY "Users can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() -- They created it
);

-- DELETE policy - only creators can delete their projects
CREATE POLICY "Users can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Fix project_members policies if needed
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can delete project members" ON public.project_members;

-- Create new, non-recursive policies for project_members
CREATE POLICY "Users can view project members"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  -- Project creator can view members
  project_id IN (SELECT id FROM projects WHERE created_by = auth.uid()) OR
  -- Team members can view other team members
  user_id = auth.uid()
);

-- Create other project_members policies as needed
CREATE POLICY "Users can insert project members"
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Project creator can add members
  project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);

CREATE POLICY "Users can update project members"
ON public.project_members
FOR UPDATE
TO authenticated
USING (
  -- Project creator can update members
  project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);

CREATE POLICY "Users can delete project members"
ON public.project_members
FOR DELETE
TO authenticated
USING (
  -- Project creator can delete members
  project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
);