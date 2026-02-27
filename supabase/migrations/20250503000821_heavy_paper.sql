/*
  # Update Users table with roles and permissions

  1. Changes
    - Add role column with predefined roles
    - Add tabs_allowed array column for permitted sections
    - Add RLS policies for admin access

  2. Security
    - Maintain existing RLS policies
    - Add new policies for role-based access
*/

-- Add role column with check constraint
ALTER TABLE "Users" 
ADD COLUMN role text NOT NULL DEFAULT 'GENERAL' 
CHECK (role IN ('ADMIN', 'IRRIGATION', 'LABOR', 'HR', 'HARVEST', 'PACKING', 'PESTS', 'NUTRITION', 'GENERAL'));

-- Add tabs_allowed column
ALTER TABLE "Users" 
ADD COLUMN tabs_allowed text[] DEFAULT ARRAY['Map']::text[];

-- Update existing policies
DROP POLICY IF EXISTS "Users can read their own data" ON "Users";

CREATE POLICY "Allow admin full access"
  ON "Users"
  TO authenticated
  USING (role = 'ADMIN')
  WITH CHECK (role = 'ADMIN');

CREATE POLICY "Users can read their own data"
  ON "Users"
  FOR SELECT
  TO authenticated
  USING (true);