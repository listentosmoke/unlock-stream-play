-- SECURE INVITE CODE ACCESS CONTROL (FIXED)
-- Add proper SELECT policy to prevent invite code theft while maintaining functionality

-- Add a highly restrictive SELECT policy that allows users to view only their own invites
-- This prevents invite code theft while allowing legitimate access
CREATE POLICY "Users can view own invites only"
ON public.invites
FOR SELECT
TO authenticated
USING (
  -- Users can ONLY see their own invites that they created
  auth.uid() = inviter_id
  OR
  -- Admins can see everything (maintain admin access)
  public.has_role(auth.uid(), 'admin')
);

-- Create a secure function for public invite validation that doesn't expose codes
-- This replaces direct code lookup with a secure validation-only function
CREATE OR REPLACE FUNCTION public.validate_invite_code(code_to_check text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    invite_exists boolean := false;
    invite_valid boolean := false;
    inviter_display_name text;
    inviter_username text;
BEGIN
    -- Check if invite exists and is valid (without exposing the actual record)
    SELECT 
        true,
        (i.is_active = true AND 
         (i.expires_at IS NULL OR i.expires_at > now()) AND 
         i.current_uses < i.max_uses),
        p.display_name,
        p.username
    INTO invite_exists, invite_valid, inviter_display_name, inviter_username
    FROM public.invites i
    LEFT JOIN public.profiles p ON p.user_id = i.inviter_id
    WHERE i.invite_code = code_to_check;
    
    -- Return validation result without exposing sensitive data
    IF NOT invite_exists THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Invalid invite code'
        );
    END IF;
    
    IF NOT invite_valid THEN
        RETURN json_build_object(
            'valid', false,
            'error', 'Invite code is no longer valid'
        );
    END IF;
    
    -- Return success with minimal inviter info (no codes exposed)
    RETURN json_build_object(
        'valid', true,
        'inviter', json_build_object(
            'display_name', inviter_display_name,
            'username', inviter_username
        )
    );
END;
$$;

-- Grant execute permission for the validation function
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO authenticated;

-- Enhance the user_roles policy to prevent role enumeration
-- Drop the existing policy that might expose too much
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Create a more restrictive policy
CREATE POLICY "Restricted role access"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  -- Users can only see their own roles
  auth.uid() = user_id
  OR
  -- Admins can see all roles
  public.has_role(auth.uid(), 'admin')
);

-- Create a function to check current user's own roles only (prevents enumeration)
CREATE OR REPLACE FUNCTION public.get_my_roles()
 RETURNS TABLE(role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
    -- Only return the current user's own roles
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: User not authenticated';
    END IF;
    
    RETURN QUERY
    SELECT ur.role
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid();
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated;