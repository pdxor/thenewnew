/*
  # Multi-User Project Management

  1. New Tables
    - `project_members` - Tracks project membership and invitation status
    - `notification_settings` - Stores user notification preferences
    - `notification_logs` - Stores notification history
    
  2. Changes
    - Add new assignees column to tasks table
    - Add new RLS policies
    
  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for team-based access
*/

-- Create enum type for project member roles
CREATE TYPE project_member_role AS ENUM ('viewer', 'contributor', 'admin', 'owner');

-- Create enum type for invitation status
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Create enum type for notification preferences
CREATE TYPE notification_frequency AS ENUM ('immediate', 'daily_digest', 'off');

-- Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role project_member_role NOT NULL DEFAULT 'contributor',
  invitation_status invitation_status NOT NULL DEFAULT 'pending',
  invitation_email TEXT NOT NULL,
  invitation_token TEXT,
  invitation_message TEXT,
  invitation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, invitation_email)
);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_invitations BOOLEAN DEFAULT true,
  task_assignments BOOLEAN DEFAULT true,
  task_updates BOOLEAN DEFAULT true,
  team_changes BOOLEAN DEFAULT true,
  reminder_timing notification_frequency DEFAULT 'immediate',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Create notification_logs table to track sent notifications
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content JSONB NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create function to automatically create notification settings on user creation
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to create notification settings when a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_settings();

-- Create function to generate invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create function to check if invitation has expired
CREATE OR REPLACE FUNCTION is_invitation_expired(expires_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Create function to update project_members updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update notification_settings updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for project_members updated_at
CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION update_project_members_updated_at();

-- Create trigger for notification_settings updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_settings_updated_at();

-- Enable Row Level Security
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Project Members Policies
CREATE POLICY "Users can view project members for their projects"
  ON project_members
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid()
        AND invitation_status = 'accepted'
      )
    )
  );

CREATE POLICY "Project admins and owners can insert project members"
  ON project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'owner')
        AND invitation_status = 'accepted'
      )
    )
  );

CREATE POLICY "Project admins and owners can update project members"
  ON project_members
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'owner')
        AND invitation_status = 'accepted'
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'owner')
        AND invitation_status = 'accepted'
      )
    )
  );

CREATE POLICY "Project admins and owners can delete project members"
  ON project_members
  FOR DELETE
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid()
      OR id IN (
        SELECT project_id FROM project_members
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'owner')
        AND invitation_status = 'accepted'
      )
    )
  );

-- Notification Settings Policies
CREATE POLICY "Users can view their own notification settings"
  ON notification_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notification settings"
  ON notification_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notification Logs Policies
CREATE POLICY "Users can view their own notifications"
  ON notification_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notification_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- This is permissive to allow the system to insert notifications

-- Fix for the error - use a simpler policy for notification_logs updates
-- Instead of trying to use OLD references, just check the user_id
CREATE POLICY "Users can update their own notification read status"
  ON notification_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Update tasks table to handle task assignments better
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignees UUID[] DEFAULT NULL;

-- Modify projects table to use project_members instead of team array
-- First, create a function to migrate team data
CREATE OR REPLACE FUNCTION migrate_team_to_project_members()
RETURNS VOID AS $$
DECLARE
  project_record RECORD;
  team_member_id UUID;
BEGIN
  FOR project_record IN SELECT id, created_by, team FROM projects WHERE team IS NOT NULL AND array_length(team, 1) > 0 LOOP
    -- Add the project creator as owner
    INSERT INTO project_members (project_id, user_id, role, invitation_status, invitation_email)
    SELECT project_record.id, project_record.created_by, 'owner'::project_member_role, 'accepted'::invitation_status, 
      (SELECT email FROM profiles WHERE user_id = project_record.created_by)
    ON CONFLICT (project_id, invitation_email) DO NOTHING;
    
    -- Add team members
    FOREACH team_member_id IN ARRAY project_record.team LOOP
      INSERT INTO project_members (project_id, user_id, role, invitation_status, invitation_email)
      SELECT project_record.id, team_member_id, 'contributor'::project_member_role, 'accepted'::invitation_status, 
        (SELECT email FROM profiles WHERE user_id = team_member_id)
      ON CONFLICT (project_id, invitation_email) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration function
SELECT migrate_team_to_project_members();

-- First, drop the existing policy if it exists
DROP POLICY IF EXISTS "Team members can view their projects" ON projects;

-- Then create the new policy
CREATE POLICY "Team members can view their projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND invitation_status = 'accepted'
    )
  );