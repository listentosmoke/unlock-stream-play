-- Remove foreign key constraint from invites table that references auth.users
-- We should not reference auth.users directly per Supabase best practices

-- First, let's check what foreign key constraints exist on invites table
-- and remove the one referencing auth.users

ALTER TABLE public.invites 
DROP CONSTRAINT IF EXISTS invites_inviter_id_fkey;

-- We don't need to add a new foreign key to profiles because:
-- 1. The application logic handles the relationship validation
-- 2. The RLS policies ensure data integrity
-- 3. We avoid issues with the auth.users table being managed by Supabase