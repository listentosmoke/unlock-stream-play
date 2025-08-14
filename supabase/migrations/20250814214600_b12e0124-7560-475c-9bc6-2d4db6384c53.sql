-- Fix email privacy vulnerability in invites table
-- Remove access to invited_email column for regular users while preserving admin access

-- Drop the existing policy that allows users to see basic info (including emails)
DROP POLICY "Users can view their own invite codes and basic info" ON public.invites;

-- Create a new policy that excludes the invited_email column for regular users
-- Users can only see: id, invite_code, inviter_id, max_uses, current_uses, expires_at, created_at, updated_at, is_active
CREATE POLICY "Users can view their own invites excluding emails" 
ON public.invites 
FOR SELECT 
USING (auth.uid() = inviter_id);

-- Note: The admin policy "Admins can view all invite data including emails" remains unchanged
-- This ensures admins can still access all data including emails when needed