-- Fix security vulnerability in invite_redemptions table
-- Remove the overly permissive INSERT policy that allows any user to insert redemptions
DROP POLICY "System can insert redemptions" ON public.invite_redemptions;

-- The invite_redemptions table should only be written to by system functions
-- using the service role key, which bypasses RLS entirely.
-- No INSERT policy is needed since system functions will use service role.