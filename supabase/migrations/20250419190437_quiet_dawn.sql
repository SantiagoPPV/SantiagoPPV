/*
  # Create Labores table

  1. New Tables
    - `Muestreos Labores`
      - `ID` (bigint, primary key)
      - `Fecha` (date, not null)
      - `Sector` (text, not null)
      - `Tunel` (integer, not null)
      - `Labor` (text, not null)

  2. Security
    - Enable RLS on `Muestreos Labores` table
    - Add policies for authenticated users to read and write their own data
*/

CREATE TABLE IF NOT EXISTS "Muestreos Labores" (
  "ID" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "Fecha" date NOT NULL,
  "Sector" text NOT NULL,
  "Tunel" integer NOT NULL,
  "Labor" text NOT NULL
);

ALTER TABLE "Muestreos Labores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated users"
  ON "Muestreos Labores"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated users"
  ON "Muestreos Labores"
  FOR SELECT
  TO authenticated
  USING (true);