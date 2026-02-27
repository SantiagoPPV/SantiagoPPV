/*
  # Add RLS policies for Muestreo nutrición table

  1. Security Changes
    - Enable RLS on "Muestreo nutrición" table
    - Add policies for:
      - Insert operations for authenticated users
      - Select operations for authenticated users
*/

ALTER TABLE "Muestreo nutrición" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated users"
  ON "Muestreo nutrición"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated users"
  ON "Muestreo nutrición"
  FOR SELECT
  TO authenticated
  USING (true);