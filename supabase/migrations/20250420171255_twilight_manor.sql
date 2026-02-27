/*
  # Create Muestreos Presiones table

  1. New Tables
    - `Muestreos Presiones`
      - `ID` (bigint, primary key, auto-incrementing)
      - `Fecha` (date, required)
      - `Sector` (text, required)
      - `Tunel` (integer, required)
      - `Presion` (numeric, required)

  2. Security
    - Enable RLS
    - Add policies for authenticated users (insert, select, update, delete)
*/

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS "Muestreos Presiones" (
  "ID" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "Fecha" date NOT NULL,
  "Sector" text NOT NULL,
  "Tunel" integer NOT NULL,
  "Presion" numeric NOT NULL
);

-- Enable RLS
ALTER TABLE "Muestreos Presiones" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow insert for authenticated users" ON "Muestreos Presiones";
  DROP POLICY IF EXISTS "Allow select for authenticated users" ON "Muestreos Presiones";
  DROP POLICY IF EXISTS "Allow update for authenticated users" ON "Muestreos Presiones";
  DROP POLICY IF EXISTS "Allow delete for authenticated users" ON "Muestreos Presiones";
END $$;

-- Create policies
CREATE POLICY "Allow insert for authenticated users"
  ON "Muestreos Presiones"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated users"
  ON "Muestreos Presiones"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow update for authenticated users"
  ON "Muestreos Presiones"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users"
  ON "Muestreos Presiones"
  FOR DELETE
  TO authenticated
  USING (true);