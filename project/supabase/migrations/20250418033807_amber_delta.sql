/*
  # Create irrigation sampling table

  1. New Tables
    - `Muestreos Riego`
      - `Fecha` (date, not null)
      - `Sector` (text, not null)
      - `Tunel` (integer, not null)
      - `Tiempo` (integer, not null)
      - `Mililitros` (integer, not null)

  2. Security
    - Enable RLS on `Muestreos Riego` table
    - Add policies for authenticated users to read and insert data
*/

CREATE TABLE IF NOT EXISTS "Muestreos Riego" (
  "Fecha" date NOT NULL,
  "Sector" text NOT NULL,
  "Tunel" integer NOT NULL,
  "Tiempo" integer NOT NULL,
  "Mililitros" integer NOT NULL
);

ALTER TABLE "Muestreos Riego" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated users"
  ON "Muestreos Riego"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated users"
  ON "Muestreos Riego"
  FOR SELECT
  TO authenticated
  USING (true);