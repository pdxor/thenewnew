/*
  # Create projects table

  1. New Tables
    - `projects`
      - `id` (uuid, primary key)
      - `title` (text)
      - `location` (text, nullable)
      - `property_status` (enum: 'owned_land' | 'potential_property')
      - `values_mission_goals` (text, nullable)
      - `guilds` (text[] array, nullable)
      - `team` (uuid[] array, nullable)
      - Permaculture Zones:
        - `zone_0` (text, nullable)
        - `zone_1` (text, nullable)
        - `zone_2` (text, nullable)
        - `zone_3` (text, nullable)
        - `zone_4` (text, nullable)
      - Infrastructure:
        - `water` (text, nullable)
        - `soil` (text, nullable)
        - `power` (text, nullable)
        - `structures` (text[] array, nullable)
      - Meta:
        - `category` (text, nullable)
        - `funding_needs` (text, nullable)
        - `created_by` (uuid, references user_id)
        - `created_at` (timestamp with time zone)
        - `updated_at` (timestamp with time zone)
  2. Security
    - Enable RLS on `projects` table
    - Add policies for authenticated users to manage projects
*/

-- Create enum type for property status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_status') THEN
    CREATE TYPE property_status AS ENUM ('owned_land', 'potential_property');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  location text,
  property_status property_status NOT NULL,
  values_mission_goals text,
  guilds text[],
  team uuid[],
  
  -- Permaculture Zones
  zone_0 text,
  zone_1 text,
  zone_2 text,
  zone_3 text,
  zone_4 text,
  
  -- Infrastructure
  water text,
  soil text,
  power text,
  structures text[],
  
  -- Meta
  category text,
  funding_needs text,
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Team members can view their projects
CREATE POLICY "Team members can view their projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    auth.uid() = ANY(team)
  );

-- Policy: Only creators can update their projects
CREATE POLICY "Creators can update their projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Policy: Authenticated users can insert projects
CREATE POLICY "Users can insert projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Policy: Only creators can delete their projects
CREATE POLICY "Creators can delete their projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at column before update
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();