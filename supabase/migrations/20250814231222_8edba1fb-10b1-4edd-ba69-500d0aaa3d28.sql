-- Fix invite redemptions INSERT policy issue
-- The redeem_invite function needs to be able to create redemption records

-- Add INSERT policy for invite_redemptions table
-- This allows the system to create redemption records when invites are redeemed
CREATE POLICY "System can create redemption records"
ON public.invite_redemptions
FOR INSERT
WITH CHECK (
  -- Only allow inserts for valid invite redemptions
  -- The invitee must be the authenticated user
  auth.uid() = invitee_id
  AND
  -- The invite must exist and be valid
  EXISTS (
    SELECT 1 FROM public.invites i
    WHERE i.id = invite_id
    AND i.is_active = true
    AND (i.expires_at IS NULL OR i.expires_at > now())
    AND i.current_uses < i.max_uses
  )
  AND
  -- Prevent duplicate redemptions
  NOT EXISTS (
    SELECT 1 FROM public.invite_redemptions existing
    WHERE existing.invite_id = invite_redemptions.invite_id
    AND existing.invitee_id = invite_redemptions.invitee_id
  )
);