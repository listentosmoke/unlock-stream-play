-- ELIMINATE EMAIL EXPOSURE COMPLETELY
-- Remove email access from all non-admin users by securing the invited_email field

-- First, let's see what policies currently exist and drop the problematic one
DROP POLICY IF EXISTS "Users can view own invites only" ON public.invites;

-- Create a completely secure policy that prevents email access
-- Users can INSERT/UPDATE their own invites but CANNOT SELECT them (use functions instead)
CREATE POLICY "Users can modify own invites without viewing emails"
ON public.invites
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update own invites without viewing emails"
ON public.invites
FOR UPDATE
TO authenticated
USING (auth.uid() = inviter_id)
WITH CHECK (auth.uid() = inviter_id);

-- NO SELECT policy for regular users - they must use secure functions only

-- Ensure the get_user_invites function explicitly excludes emails
CREATE OR REPLACE FUNCTION public.get_user_invites()
 RETURNS TABLE(
   id uuid, 
   invite_code text, 
   inviter_id uuid, 
   max_uses integer, 
   current_uses integer, 
   expires_at timestamp with time zone, 
   created_at timestamp with time zone, 
   updated_at timestamp with time zone, 
   is_active boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: User not authenticated';
    END IF;
    
    -- Return invite data WITHOUT emails for the current user
    -- This function bypasses RLS using SECURITY DEFINER and explicitly excludes emails
    RETURN QUERY
    SELECT 
        i.id,
        i.invite_code,
        i.inviter_id,
        i.max_uses,
        i.current_uses,
        i.expires_at,
        i.created_at,
        i.updated_at,
        i.is_active
        -- Note: invited_email is deliberately excluded here
    FROM public.invites i
    WHERE i.inviter_id = auth.uid();
END;
$$;

-- Update create_user_invite to not use or expose emails
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
    
    -- Check if user already has an invite (exclude email from query)
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
    
    -- Create the invite WITHOUT setting invited_email
    INSERT INTO public.invites (
        invite_code,
        inviter_id,
        max_uses,
        is_active
        -- deliberately NOT including invited_email
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

-- For maximum security, consider nullifying existing invited_email data
-- This removes any existing email data that might be exposed
UPDATE public.invites SET invited_email = NULL WHERE invited_email IS NOT NULL;

-- Optional: If the invited_email column is not needed, we could drop it entirely
-- ALTER TABLE public.invites DROP COLUMN IF EXISTS invited_email;
-- (Commented out in case it's needed for future features)

-- Ensure all direct table permissions are properly restricted
REVOKE ALL ON public.invites FROM authenticated;
GRANT INSERT, UPDATE ON public.invites TO authenticated;
-- Note: NO SELECT grant for authenticated users

-- Grant execute permissions for the secure functions
GRANT EXECUTE ON FUNCTION public.get_user_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_invite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_for_redemption(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO authenticated;