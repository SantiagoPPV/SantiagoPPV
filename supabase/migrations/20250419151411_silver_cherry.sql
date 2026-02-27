/*
  # Create Muestreos Empaque table

  1. New Tables
    - `Muestreos Empaque`
      - `Fecha` (date, required)
      - `Proveedor` (text, required)
      - `Cantidad_cajas` (integer, required)
      - `Tipo_embalaje` (text, required)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS "Muestreos Empaque" (
  "Fecha" date NOT NULL,
  "Proveedor" text NOT NULL,
  "Cantidad_cajas" integer NOT NULL,
  "Tipo_embalaje" text NOT NULL
);

ALTER TABLE "Muestreos Empaque" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated users"
  ON "Muestreos Empaque"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated users"
  ON "Muestreos Empaque"
  FOR SELECT
  TO authenticated
  USING (true);