/*
  # Create sampling logs table

  1. New Tables
    - `sampling_logs`
      - `id` (uuid, primary key)
      - `pest_type` (text)
      - `sampling_date` (date)
      - `sector` (text)
      - `tunnel` (integer)
      - `quantity` (integer)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `sampling_logs` table
    - Add policies for authenticated users to read and insert their own data
*/

CREATE TABLE IF NOT EXISTS sampling_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pest_type text NOT NULL,
  sampling_date date NOT NULL,
  sector text NOT NULL,
  tunnel integer NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sampling_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read sampling logs"
  ON sampling_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert sampling logs"
  ON sampling_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);