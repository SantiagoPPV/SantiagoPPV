/*
  # Update Users table schema

  1. Changes
    - Remove role and tabs_allowed columns
    - Add tabs column for storing comma-separated UI access permissions
    - Update existing data

  2. Security
    - Maintain existing RLS policies
*/

-- Remove old columns
ALTER TABLE "Users" 
DROP COLUMN IF EXISTS role,
DROP COLUMN IF EXISTS tabs_allowed;

-- Add new tabs column
ALTER TABLE "Users" 
ADD COLUMN IF NOT EXISTS tabs text NOT NULL DEFAULT 'Mapa';

-- Update existing users to have access to all tabs
UPDATE "Users"
SET tabs = 'Mapa,Muestreos,Personal,Administración,Reportes,Configuración'
WHERE email = 's.agricolamoray@gmail.com';