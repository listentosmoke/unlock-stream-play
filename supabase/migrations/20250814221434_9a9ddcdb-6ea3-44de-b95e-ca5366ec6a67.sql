-- Fix invite redemption security issue by adding proper INSERT policy
-- This allows users to create redemption records when using valid invite codes

CREATE POLICY "Users can create invite redemptions for valid invites" 
ON public.invite_redemptions 
FOR INSERT 
WITH CHECK (
    -- The invitee must be the authenticated user
    auth.uid() = invitee_id
    AND
    -- The invite must exist, be active, and not expired
    EXISTS (
        SELECT 1 FROM public.invites i
        WHERE i.id = invite_id
        AND i.is_active = true
        AND (i.expires_at IS NULL OR i.expires_at > now())
        AND i.current_uses < i.max_uses
        AND i.inviter_id = inviter_id  -- Ensure inviter_id matches the invite's creator
    )
    AND
    -- Prevent duplicate redemptions by the same user for the same invite
    NOT EXISTS (
        SELECT 1 FROM public.invite_redemptions ir
        WHERE ir.invite_id = invite_redemptions.invite_id
        AND ir.invitee_id = auth.uid()
    )
);