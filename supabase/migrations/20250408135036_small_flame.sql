/*
  # Add Tasks and Inventory Items tables

  1. New Tables
    - `tasks` table
      - Task management with status, priority, due dates
      - Connection to projects and assignments to users
      - Row level security for appropriate access control
    
    - `items` table
      - Inventory item tracking with quantities
      - Different item types (needed, owned, borrowed)
      - Connection to projects and tasks
      - Row level security for appropriate access control
    
  2. Security
    - Enable RLS on both tables
    - Add policies for CRUD operations
    - Link to existing auth system
*/

-- Create tasks table
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'blocked');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  is_project_task BOOLEAN NOT NULL DEFAULT false,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create items table
CREATE TYPE item_type AS ENUM ('needed_supply', 'owned_resource', 'borrowed_or_rental');

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  item_type item_type NOT NULL DEFAULT 'needed_supply',
  fundraiser BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[],
  quantity_needed INTEGER DEFAULT 0,
  quantity_owned INTEGER DEFAULT 0,
  quantity_borrowed INTEGER DEFAULT 0,
  unit TEXT,
  product_link TEXT,
  info_link TEXT,
  image_url TEXT,
  associated_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create triggers for updated_at timestamp
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Tasks RLS Policies
CREATE POLICY "Users can view their own tasks or tasks for projects they're a member of"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM projects 
      WHERE created_by = auth.uid() OR auth.uid() = ANY(team)
    ))
  );

CREATE POLICY "Users can insert tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own tasks or tasks for projects they're a member of"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM projects 
      WHERE created_by = auth.uid() OR auth.uid() = ANY(team)
    ))
  );

CREATE POLICY "Users can delete their own tasks or tasks for projects they created"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    ))
  );

-- Items RLS Policies
CREATE POLICY "Users can view their own items or items for projects they're a member of"
  ON items
  FOR SELECT
  TO authenticated
  USING (
    added_by = auth.uid() OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM projects 
      WHERE created_by = auth.uid() OR auth.uid() = ANY(team)
    )) OR
    (associated_task_id IS NOT NULL AND associated_task_id IN (
      SELECT id FROM tasks
      WHERE created_by = auth.uid() OR assigned_to = auth.uid()
    ))
  );

CREATE POLICY "Users can insert items"
  ON items
  FOR INSERT
  TO authenticated
  WITH CHECK (added_by = auth.uid());

CREATE POLICY "Users can update their own items or items for projects they're a member of"
  ON items
  FOR UPDATE
  TO authenticated
  USING (
    added_by = auth.uid() OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM projects 
      WHERE created_by = auth.uid() OR auth.uid() = ANY(team)
    )) OR
    (associated_task_id IS NOT NULL AND associated_task_id IN (
      SELECT id FROM tasks
      WHERE created_by = auth.uid() OR assigned_to = auth.uid()
    ))
  );

CREATE POLICY "Users can delete their own items or items for projects they created"
  ON items
  FOR DELETE
  TO authenticated
  USING (
    added_by = auth.uid() OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid()
    ))
  );