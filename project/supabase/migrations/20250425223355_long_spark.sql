/*
  # Update Muestreos Probetas table

  1. Changes
    - Rename "Presion" column to "Mililitros"
    - Change "Hora" column type from time to text to store period of day

  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE "Muestreos Probetas" 
  RENAME COLUMN "Presion" TO "Mililitros";

ALTER TABLE "Muestreos Probetas" 
  ALTER COLUMN "Mililitros" TYPE integer USING "Mililitros"::integer;

ALTER TABLE "Muestreos Probetas"
  ALTER COLUMN "Hora" TYPE text;