/*
  # Fix infinite recursion in projects RLS policy

  1. Changes
     - Update the SELECT policy for projects table to eliminate circular dependency
     - Simplify the policy to prevent infinite recursion while maintaining security

  2. Security
     - Maintains the same level of access control without circular references
     - Users can still view their own projects and projects they're invited to
*/

-- Drop the existing policies that are causing the recursion
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;

-- Create new policy without circular dependencies
CREATE POLICY "Users can view their own projects" 
ON projects 
FOR SELECT 
TO authenticated
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 
    FROM project_members
    WHERE 
      project_members.project_id = projects.id AND 
      project_members.user_id = auth.uid() AND 
      project_members.invitation_status = 'accepted'
  )
);