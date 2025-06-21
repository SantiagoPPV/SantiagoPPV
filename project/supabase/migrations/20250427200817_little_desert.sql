/*
  # Create Personal Moray table

  1. New Tables
    - `Personal Moray`
      - `ID` (bigint, primary key, auto-incrementing)
      - `Nombre` (text, required) - Worker's name
      - `Categoria` (text, required) - Category (Comedor/Labores/Fumigación)
      - `Labor Asignada` (text) - Currently assigned labor
      - `Fecha Ingreso` (date, required) - Entry date
      - `Estado` (text, required) - Status (Activo/Inactivo)
      - `Fecha Baja` (date) - Discharge date
      - `created_at` (timestamptz, auto) - Record creation timestamp

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS "Personal Moray" (
  "ID" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "Nombre" text NOT NULL,
  "Categoria" text NOT NULL CHECK ("Categoria" IN ('Comedor', 'Labores', 'Fumigación')),
  "Labor Asignada" text,
  "Fecha Ingreso" date NOT NULL,
  "Estado" text NOT NULL CHECK ("Estado" IN ('Activo', 'Inactivo')),
  "Fecha Baja" date,
  "created_at" timestamptz DEFAULT now()
);

ALTER TABLE "Personal Moray" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated users"
  ON "Personal Moray"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated users"
  ON "Personal Moray"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow update for authenticated users"
  ON "Personal Moray"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated users"
  ON "Personal Moray"
  FOR DELETE
  TO authenticated
  USING (true);