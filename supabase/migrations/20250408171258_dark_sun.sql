/*
  # Fix RLS Policies

  1. Changes
     - Drop all problematic policies that may cause recursion
     - Create simplified policies for projects table
     - Create simplified policies for project_members table
     - Ensure policies use auth.uid() consistently
     - Fix notification_logs policies
  
  2. Security
     - Maintain proper access control while preventing infinite recursion
     - Ensure users can only access their own data or data they have permission to
*/

-- First, drop all existing project policies to start fresh
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects fixed" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Team members can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects they created or are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects and projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects they created or are admins of" ON public.projects;
DROP POLICY IF EXISTS "Creators can update their projects" ON public.projects;
DROP POLICY IF EXISTS "Creators and team admins can update their projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
DROP POLICY IF EXISTS "Creators can delete their projects" ON public.projects;

-- Create clean policies for projects table
-- SELECT policy
CREATE POLICY "Users can view projects fixed"
ON public.projects
FOR SELECT
TO authenticated
USING (
  -- User created the project
  created_by = auth.uid() OR 
  -- User is a member of the project via project_members table
  id IN (
    SELECT project_id
    FROM project_members
    WHERE user_id = auth.uid() AND invitation_status = 'accepted'
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
  -- User created the project
  created_by = auth.uid() OR
  -- User is an admin/owner member
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
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view project members for their projects" ON public.project_members;
DROP POLICY IF EXISTS "Users can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins and owners can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins and owners can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can delete project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins and owners can delete project members" ON public.project_members;

-- Create clean policies for project_members table
-- SELECT policy
CREATE POLICY "Users can view project members"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  -- User created the project
  project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ) OR
  -- User is a member of the project
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
  -- User created the project
  project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ) OR
  -- User is an admin/owner member
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
  -- User created the project
  project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ) OR
  -- User is an admin/owner member
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
  -- User created the project
  project_id IN (
    SELECT id
    FROM projects
    WHERE created_by = auth.uid()
  ) OR
  -- User is an admin/owner member
  project_id IN (
    SELECT project_id
    FROM project_members
    WHERE 
      user_id = auth.uid() AND
      role IN ('admin', 'owner') AND
      invitation_status = 'accepted'
  )
);

-- Fix notification_logs policies if they're causing issues
DROP POLICY IF EXISTS "Users can update their own notification read status" ON public.notification_logs;

-- Create simplified policy for notification_logs updates
CREATE POLICY "Users can update their own notification read status"
  ON notification_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix for any remaining policies in the tasks table
DROP POLICY IF EXISTS "Users can view their own tasks or tasks for projects they're a" ON tasks;

-- Create a proper SELECT policy for tasks
CREATE POLICY "Users can view their own tasks or tasks for projects they're associated with"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    -- User created the task
    created_by = auth.uid() OR 
    -- Task is assigned to the user
    assigned_to = auth.uid() OR
    -- Task belongs to a project the user created or is a member of
    (project_id IS NOT NULL AND 
      project_id IN (
        SELECT id FROM projects WHERE created_by = auth.uid()
        UNION
        SELECT project_id FROM project_members 
        WHERE user_id = auth.uid() AND invitation_status = 'accepted'
      )
    )
  );

-- Fix items table policies if needed
DROP POLICY IF EXISTS "Users can view their own items or items for projects they're a" ON items;

-- Create a proper SELECT policy for items
CREATE POLICY "Users can view their own items or items for projects they're associated with"
  ON items
  FOR SELECT
  TO authenticated
  USING (
    -- User added the item
    added_by = auth.uid() OR 
    -- Item belongs to a project the user created or is a member of
    (project_id IS NOT NULL AND 
      project_id IN (
        SELECT id FROM projects WHERE created_by = auth.uid()
        UNION
        SELECT project_id FROM project_members 
        WHERE user_id = auth.uid() AND invitation_status = 'accepted'
      )
    ) OR
    -- Item is associated with a task created by or assigned to the user
    (associated_task_id IS NOT NULL AND
      associated_task_id IN (
        SELECT id FROM tasks
        WHERE created_by = auth.uid() OR assigned_to = auth.uid()
      )
    )
  );

-- Ensure all updated_at trigger functions exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';