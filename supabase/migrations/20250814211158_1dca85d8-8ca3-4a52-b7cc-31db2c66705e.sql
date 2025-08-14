-- Fix the generate_invite_code function to use available functions
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  code TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code using random()
    code := upper(
      lpad(floor(random() * 1000000000)::text, 9, '0')
    );
    -- Take first 8 characters and replace confusing ones
    code := substring(code from 1 for 8);
    code := replace(replace(replace(replace(code, '0', '9'), '1', '8'), '2', '7'), '3', '6');
    
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
$function$;

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