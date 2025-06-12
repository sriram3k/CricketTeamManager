-- Migration: Add purpose column to payments table
-- Created: 2024-01-11

ALTER TABLE payments ADD COLUMN purpose TEXT NOT NULL DEFAULT 'Match fee';

-- Update existing records to have a default purpose
UPDATE payments SET purpose = 'Match fee' WHERE purpose IS NULL;