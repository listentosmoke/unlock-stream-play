-- Implement proper column-level security using security definer function
-- Create a function that returns invite data without emails for regular users

-- Create a security definer function for user-safe invite access
CREATE OR REPLACE FUNCTION public.get_user_invites()
RETURNS TABLE (
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
SET search_path = 'public'
AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: User not authenticated';
    END IF;
    
    -- Return invite data without emails for the current user
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
    FROM public.invites i
    WHERE i.inviter_id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_invites() TO authenticated;

-- Update the table policy - remove user access to the table directly
-- Regular users should use the function instead
DROP POLICY "Users can view their own invites excluding emails" ON public.invites;