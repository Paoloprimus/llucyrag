-- Migration: has_rag → modules
-- Run this in Supabase SQL Editor

-- Add modules column
ALTER TABLE users ADD COLUMN IF NOT EXISTS modules jsonb DEFAULT '{"diario": false}';

-- Migrate existing has_rag data to modules.diario
UPDATE users SET modules = jsonb_build_object('diario', COALESCE(has_rag, false));

-- Drop old column (optional - can keep for rollback)
-- ALTER TABLE users DROP COLUMN IF EXISTS has_rag;
