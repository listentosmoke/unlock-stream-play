-- Create invites table
CREATE TABLE public.invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  invited_email TEXT,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create invite_redemptions table
CREATE TABLE public.invite_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_id UUID NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  inviter_points_awarded INTEGER NOT NULL DEFAULT 50,
  invitee_points_awarded INTEGER NOT NULL DEFAULT 25,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for invites table
CREATE POLICY "Users can view their own invites"
ON public.invites
FOR SELECT
USING (auth.uid() = inviter_id);

CREATE POLICY "Users can create their own invites"
ON public.invites
FOR INSERT
WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update their own invites"
ON public.invites
FOR UPDATE
USING (auth.uid() = inviter_id);

CREATE POLICY "Admins can view all invites"
ON public.invites
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- RLS policies for invite_redemptions table
CREATE POLICY "Users can view their own redemptions"
ON public.invite_redemptions
FOR SELECT
USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "System can insert redemptions"
ON public.invite_redemptions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all redemptions"
ON public.invite_redemptions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE user_id = auth.uid() AND role = 'admin'
));

-- Add referral transaction type (update existing enum)
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'referral';

-- Create indexes for better performance
CREATE INDEX idx_invites_code ON public.invites(invite_code);
CREATE INDEX idx_invites_inviter ON public.invites(inviter_id);
CREATE INDEX idx_redemptions_invite ON public.invite_redemptions(invite_id);
CREATE INDEX idx_redemptions_inviter ON public.invite_redemptions(inviter_id);
CREATE INDEX idx_redemptions_invitee ON public.invite_redemptions(invitee_id);

-- Add updated_at trigger for invites
CREATE TRIGGER update_invites_updated_at
  BEFORE UPDATE ON public.invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    code := upper(substring(encode(gen_random_bytes(6), 'base64') from 1 for 8));
    -- Remove potentially confusing characters
    code := replace(replace(replace(replace(code, '0', ''), '1', ''), 'O', ''), 'I', '');
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM public.invites WHERE invite_code = code) THEN
      RETURN code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Unable to generate unique invite code after 10 attempts';
    END IF;
  END LOOP;
END;
$$;