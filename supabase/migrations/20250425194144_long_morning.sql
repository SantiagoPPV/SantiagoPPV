/*
  # Create Muestreos Probetas table

  1. New Tables
    - `Muestreos Probetas`
      - `ID` (bigint, primary key, auto-incrementing)
      - `Fecha` (date, required)
      - `Sector` (text, required)
      - `Presion` (numeric, required)
      - `Hora` (time without time zone, required)
      - `Semana` (integer)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS "Muestreos Probetas" (
  "ID" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "Fecha" date NOT NULL,
  "Sector" text NOT NULL,
  "Presion" numeric NOT NULL,
  "Hora" time without time zone NOT NULL,
  "Semana" integer
);

ALTER TABLE "Muestreos Probetas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated users"
  ON "Muestreos Probetas"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated users"
  ON "Muestreos Probetas"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow update for authenticated users"
  ON "Muestreos Probetas"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users"
  ON "Muestreos Probetas"
  FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for automatic week calculation
CREATE TRIGGER set_isoweek
  BEFORE INSERT ON "Muestreos Probetas"
  FOR EACH ROW
  EXECUTE FUNCTION update_isoweek();