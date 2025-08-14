-- Create a unique invite code for each existing user profile
-- This ensures every user gets exactly one permanent invite link

-- First, let's make sure we have a unique constraint on user + invite combo
-- and update existing invites structure for the new system

-- Add a unique constraint to ensure one invite per user
ALTER TABLE public.invites ADD CONSTRAINT unique_user_invite UNIQUE (inviter_id);

-- Insert a unique invite for each user who doesn't have one yet
INSERT INTO public.invites (inviter_id, invite_code, max_uses, is_active)
SELECT 
  p.user_id,
  generate_invite_code(),
  999999, -- Essentially unlimited uses for permanent invite
  true
FROM public.profiles p
LEFT JOIN public.invites i ON p.user_id = i.inviter_id
WHERE i.inviter_id IS NULL;

-- Update any existing invites to be permanent (unlimited uses)
UPDATE public.invites 
SET max_uses = 999999, is_active = true, expires_at = NULL
WHERE max_uses != 999999;