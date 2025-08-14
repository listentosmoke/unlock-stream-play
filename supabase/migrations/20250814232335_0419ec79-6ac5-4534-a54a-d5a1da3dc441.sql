-- FINAL CLEANUP: Remove any remaining policies that could expose emails
-- This ensures complete security of email addresses

-- Check and remove any remaining problematic policies
DROP POLICY IF EXISTS "Secure invite redemption lookup" ON public.invites;
DROP POLICY IF EXISTS "Users can view invite info for redemption by code" ON public.invites;

-- Ensure the invites table has ONLY these secure policies:
-- 1. Admins full access
-- 2. Users can create their own invites  
-- 3. Users can update their own invites
-- NO SELECT policies for regular users whatsoever

-- Verify the get_invite_for_redemption function is completely isolated
CREATE OR REPLACE FUNCTION public.get_invite_for_redemption(invite_code_param text)
 RETURNS TABLE(
   id uuid,
   inviter_id uuid,
   max_uses integer,
   current_uses integer,
   expires_at timestamp with time zone,
   is_active boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- This function completely bypasses RLS
  -- It NEVER returns email addresses under any circumstances
  -- It only returns the minimal data needed for redemption validation
  RETURN QUERY
  SELECT 
    i.id,
    i.inviter_id,
    i.max_uses,
    i.current_uses,
    i.expires_at,
    i.is_active
  FROM public.invites i
  WHERE i.invite_code = invite_code_param
  AND i.is_active = true
  AND (i.expires_at IS NULL OR i.expires_at > now());
END;
$$;

-- Update the create_user_invite function to not expose emails in any way
CREATE OR REPLACE FUNCTION public.create_user_invite()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    current_user_id uuid;
    new_invite_code text;
    invite_record_safe RECORD;
BEGIN
    -- Get the authenticated user
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User must be authenticated'
        );
    END IF;
    
    -- Check if user already has an invite (without exposing emails)
    SELECT 
        id, invite_code, inviter_id, max_uses, current_uses, 
        expires_at, created_at, updated_at, is_active
    INTO invite_record_safe
    FROM public.invites
    WHERE inviter_id = current_user_id
    LIMIT 1;
    
    -- If user already has an invite, return it (without email)
    IF FOUND THEN
        RETURN json_build_object(
            'success', true,
            'invite', row_to_json(invite_record_safe),
            'message', 'Existing invite found'
        );
    END IF;
    
    -- Generate a new invite code
    SELECT generate_invite_code() INTO new_invite_code;
    
    -- Create the invite (email will be NULL, which is fine)
    INSERT INTO public.invites (
        invite_code,
        inviter_id,
        max_uses,
        is_active
    ) VALUES (
        new_invite_code,
        current_user_id,
        999999,
        true
    ) RETURNING 
        id, invite_code, inviter_id, max_uses, current_uses, 
        expires_at, created_at, updated_at, is_active
    INTO invite_record_safe;
    
    -- Return success with the new invite (without email)
    RETURN json_build_object(
        'success', true,
        'invite', row_to_json(invite_record_safe),
        'message', 'New invite created successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to create invite: ' || SQLERRM
        );
END;
$$;

-- Ensure all functions have proper permissions
GRANT EXECUTE ON FUNCTION public.get_invite_for_redemption(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_invite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_invites() TO authenticated;

-- For extra security, revoke any potential direct table access
REVOKE ALL ON public.invites FROM authenticated;
-- Then grant only the minimal required permissions
GRANT INSERT ON public.invites TO authenticated;
GRANT UPDATE ON public.invites TO authenticated;
-- NO SELECT GRANT - users must use secure functions only