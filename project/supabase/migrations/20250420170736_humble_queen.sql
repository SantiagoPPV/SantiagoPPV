/*
  # Create Muestreos Cosecha table

  1. New Tables
    - `Muestreos Cosecha`
      - `Fecha` (date, required)
      - `Sector` (text, required)
      - `Tunel_inicio` (integer, required)
      - `Tunel_final` (integer, required)
      - `Cantidad_cubetas` (integer, required)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS "Muestreos Cosecha" (
  "Fecha" date NOT NULL,
  "Sector" text NOT NULL,
  "Tunel_inicio" integer NOT NULL,
  "Tunel_final" integer NOT NULL,
  "Cantidad_cubetas" integer NOT NULL
);

-- Enable RLS
ALTER TABLE "Muestreos Cosecha" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow insert for authenticated users" ON "Muestreos Cosecha";
  DROP POLICY IF EXISTS "Allow select for authenticated users" ON "Muestreos Cosecha";
END $$;

-- Create policies
CREATE POLICY "Allow insert for authenticated users"
  ON "Muestreos Cosecha"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated users"
  ON "Muestreos Cosecha"
  FOR SELECT
  TO authenticated
  USING (true);