/*
  # Create relationship between projects and profiles

  1. Updates
    - Add trigger to update profile's current_projects when added to a project
  
  2. Functions
    - Create function to update profile's current_projects array
    - Create function to maintain profile's current_projects when removed from a project
*/

-- Function to update profile's current_projects when added to a project
CREATE OR REPLACE FUNCTION update_profile_projects()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if no team members
  IF NEW.team IS NULL OR array_length(NEW.team, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Update profiles for team members
  UPDATE profiles
  SET current_projects = array_append(COALESCE(current_projects, '{}'), NEW.id)
  WHERE user_id = ANY(NEW.team);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update profile's current_projects when removed from a project
CREATE OR REPLACE FUNCTION update_profile_projects_on_team_change()
RETURNS TRIGGER AS $$
DECLARE
  removed_members uuid[];
BEGIN
  -- Find members removed from the team
  IF OLD.team IS NOT NULL AND NEW.team IS NOT NULL THEN
    SELECT array_agg(member) INTO removed_members
    FROM unnest(OLD.team) AS member
    WHERE member != ALL(COALESCE(NEW.team, '{}'::uuid[]));
  ELSIF OLD.team IS NOT NULL AND (NEW.team IS NULL OR array_length(NEW.team, 1) IS NULL) THEN
    removed_members := OLD.team;
  ELSE
    removed_members := '{}'::uuid[];
  END IF;
  
  -- Remove project from current_projects for removed members
  IF removed_members IS NOT NULL AND array_length(removed_members, 1) > 0 THEN
    UPDATE profiles
    SET current_projects = array_remove(current_projects, OLD.id)
    WHERE user_id = ANY(removed_members);
  END IF;
  
  -- Add project to current_projects for new members
  IF NEW.team IS NOT NULL AND array_length(NEW.team, 1) > 0 THEN
    UPDATE profiles
    SET current_projects = array_append(COALESCE(current_projects, '{}'), NEW.id)
    WHERE user_id = ANY(NEW.team) 
    AND (current_projects IS NULL OR NOT (NEW.id = ANY(current_projects)));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to remove project from profiles when project is deleted
CREATE OR REPLACE FUNCTION remove_project_from_profiles()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove project from all profiles
  UPDATE profiles
  SET current_projects = array_remove(current_projects, OLD.id)
  WHERE current_projects IS NOT NULL AND OLD.id = ANY(current_projects);
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for project creation
CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_projects();

-- Trigger for team changes
CREATE TRIGGER on_project_team_changed
  AFTER UPDATE OF team ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_projects_on_team_change();

-- Trigger for project deletion
CREATE TRIGGER on_project_deleted
  BEFORE DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION remove_project_from_profiles();