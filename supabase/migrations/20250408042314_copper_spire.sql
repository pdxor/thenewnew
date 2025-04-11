/*
  # Add business plans table

  1. New Tables
    - `business_plans`
      - `id` (uuid, primary key)
      - `project_id` (uuid, references projects.id)
      - `content` (text, the business plan content)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `business_plans` table
    - Add policies for authenticated users to manage their business plans
*/

-- Create business_plans table
CREATE TABLE IF NOT EXISTS business_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add updated_at trigger
CREATE TRIGGER update_business_plans_updated_at
BEFORE UPDATE ON business_plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view business plans for their projects"
  ON business_plans
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE created_by = auth.uid() 
      OR auth.uid() = ANY(team)
    )
  );

CREATE POLICY "Users can insert business plans for their projects"
  ON business_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE created_by = auth.uid() 
      OR auth.uid() = ANY(team)
    )
  );

CREATE POLICY "Users can update business plans for their projects"
  ON business_plans
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE created_by = auth.uid() 
      OR auth.uid() = ANY(team)
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects 
      WHERE created_by = auth.uid() 
      OR auth.uid() = ANY(team)
    )
  );

CREATE POLICY "Users can delete business plans for their projects"
  ON business_plans
  FOR DELETE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE created_by = auth.uid() 
      OR auth.uid() = ANY(team)
    )
  );