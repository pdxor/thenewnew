/*
  # Fix Projects Table RLS Policy Infinite Recursion

  1. Changes
    - Drop and recreate the SELECT policy for the projects table to avoid infinite recursion
    - Modify the policy to use a simpler condition that doesn't cause circular references
    - The policy now uses a direct comparison with UID instead of nested subqueries that could create loops

  2. Security
    - Maintains the same access control intent:
      - Users can see projects they created
      - Users can see projects where they are members with accepted invitations
*/

-- Drop the existing policy that's causing recursion issues
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;

-- Create a new policy with optimized conditions that avoid recursion
CREATE POLICY "Users can view their own projects" 
ON projects
FOR SELECT 
TO authenticated
USING (
  created_by = auth.uid() OR
  id IN (
    SELECT project_id 
    FROM project_members 
    WHERE 
      user_id = auth.uid() AND 
      invitation_status = 'accepted'
  )
);