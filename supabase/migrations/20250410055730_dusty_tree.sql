/*
  # Add support for member board system

  1. Updates
    - Add foreign key references for profiles in tasks table
    - Add index on profiles.email for faster member search
    - Ensure proper RLS policies for team member access
  
  2. Security
    - Update RLS policies to allow team members to view and update content
*/

-- Add index on profiles.email for faster member search
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

-- Ensure tasks table has proper foreign key references
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey,
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id);

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey,
  ADD CONSTRAINT tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to)
  REFERENCES auth.users(id);

-- Update RLS policies for projects to allow team members to view and update
DROP POLICY IF EXISTS "Users can view projects" ON projects;
CREATE POLICY "Users can view projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    auth.uid() = ANY(team)
  );

-- Update RLS policies for tasks to allow team members to view and update
DROP POLICY IF EXISTS "Users can view their tasks" ON tasks;
CREATE POLICY "Users can view tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    (project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid() OR auth.uid() = ANY(team)
    ))
  );

DROP POLICY IF EXISTS "Users can update their tasks" ON tasks;
CREATE POLICY "Users can update tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    (project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid() OR auth.uid() = ANY(team)
    ))
  );

-- Update RLS policies for items to allow team members to view and update
DROP POLICY IF EXISTS "Users can view items" ON items;
CREATE POLICY "Users can view items"
  ON items
  FOR SELECT
  TO authenticated
  USING (
    added_by = auth.uid() OR
    (project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid() OR auth.uid() = ANY(team)
    )) OR
    (associated_task_id IN (
      SELECT id FROM tasks
      WHERE created_by = auth.uid() OR assigned_to = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can update their items" ON items;
CREATE POLICY "Users can update items"
  ON items
  FOR UPDATE
  TO authenticated
  USING (
    added_by = auth.uid() OR
    (project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid() OR auth.uid() = ANY(team)
    ))
  );