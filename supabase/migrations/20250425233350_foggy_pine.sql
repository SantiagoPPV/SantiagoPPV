/*
  # Set up authentication and Users table

  1. New Tables
    - `Users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `password` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create Users table
CREATE TABLE IF NOT EXISTS "Users" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read their own data"
  ON "Users"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Insert default user
INSERT INTO "Users" (id, email, password)
VALUES (
  gen_random_uuid(),
  's.agricolamoray@gmail.com',
  'Avmoray120'
) ON CONFLICT (email) DO NOTHING;