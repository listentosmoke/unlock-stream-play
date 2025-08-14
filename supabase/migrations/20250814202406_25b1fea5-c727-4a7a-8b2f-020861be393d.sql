-- Fix security issue with generate_invite_code function
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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