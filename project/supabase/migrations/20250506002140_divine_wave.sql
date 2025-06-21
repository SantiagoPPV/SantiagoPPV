/*
  # Add Tipo column to Muestreos Nutricion table

  1. Changes
    - Add Tipo column to distinguish between "Goteros" and "Exprimidos" samples
    - Set default value to "Goteros" for existing records

  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE "Muestreos Nutricion"
ADD COLUMN IF NOT EXISTS "Tipo" text NOT NULL DEFAULT 'Goteros'
CHECK ("Tipo" IN ('Goteros', 'Exprimidos'));

-- Update existing records to have Tipo = 'Goteros'
UPDATE "Muestreos Nutricion"
SET "Tipo" = 'Goteros'
WHERE "Tipo" IS NULL;