/*
  # Fix duplicate policies for projects table

  1. Policies
    - Avoid creating duplicate policies by dropping existing ones first
    - Recreate all project policies with consistent permissions
  
  2. Security
    - Ensure RLS is enabled on the projects table
    - Maintain proper access control for authenticated users
*/

-- Check if policies exist and drop them first
DO $$
BEGIN
  -- Only attempt to drop if the policy exists
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Creators can update their projects' AND tablename = 'projects') THEN
    DROP POLICY IF EXISTS "Creators can update their projects" ON projects;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Creators can delete their projects' AND tablename = 'projects') THEN
    DROP POLICY IF EXISTS "Creators can delete their projects" ON projects;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team members can view their projects' AND tablename = 'projects') THEN
    DROP POLICY IF EXISTS "Team members can view their projects" ON projects;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert projects' AND tablename = 'projects') THEN
    DROP POLICY IF EXISTS "Users can insert projects" ON projects;
  END IF;
END
$$;

-- Ensure RLS is enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policies with consistent naming and logic
CREATE POLICY "Creators can update their projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Creators can delete their projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Team members can view their projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING ((created_by = auth.uid()) OR (auth.uid() = ANY (team)));

CREATE POLICY "Users can insert projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());