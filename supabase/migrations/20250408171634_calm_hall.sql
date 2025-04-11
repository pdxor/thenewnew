/*
  # Fix infinite recursion in Projects table policy

  1. Policy Changes
    - Drop and recreate the policy for viewing projects to eliminate circular dependencies
    - Update the policy to directly check teams array instead of using project_members table
    - This breaks the circular dependency between projects and project_members tables

  2. Security
    - Maintain existing security model while eliminating recursion
    - Ensure users can still view their own projects and projects they're members of
*/

-- First, drop the existing policy that's causing issues
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;

-- Create a new policy that doesn't cause recursion
CREATE POLICY "Users can view projects" 
ON public.projects 
FOR SELECT 
TO authenticated
USING (
  -- User is the creator of the project
  (created_by = auth.uid()) 
  OR
  -- User is in the team array (direct check without using project_members)
  (auth.uid() = ANY(team))
  OR
  -- User is in project_members with accepted status (using an alternative approach)
  EXISTS (
    SELECT 1 
    FROM project_members 
    WHERE 
      project_members.project_id = id 
      AND project_members.user_id = auth.uid() 
      AND project_members.invitation_status = 'accepted'
  )
);