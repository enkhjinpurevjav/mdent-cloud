-- Add marketing role for dedicated marketing portal users.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'marketing';
