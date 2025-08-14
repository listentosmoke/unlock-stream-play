-- Create a secure view for user invite management that excludes sensitive email data

-- Create a view that excludes email data for regular users
CREATE OR REPLACE VIEW public.user_invites_safe AS
SELECT 
    id,
    invite_code,
    inviter_id,
    max_uses,
    current_uses,
    expires_at,
    created_at,
    updated_at,
    is_active
    -- Deliberately exclude invited_email for security
FROM public.invites;

-- Enable RLS on the view
ALTER VIEW public.user_invites_safe SET (security_invoker = on);

-- Grant access to authenticated users
GRANT SELECT ON public.user_invites_safe TO authenticated;

-- Remove the direct table access policy for non-admins
DROP POLICY IF EXISTS "Secure invite redemption lookup" ON public.invites;

-- Create a highly restrictive policy for direct table access
CREATE POLICY "Admin only direct invite access"
ON public.invites
FOR ALL
USING (
  -- Only admins can access the table directly (with email data)
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Update get_user_invites function to use the safe view
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
    
    -- Return invite data without emails for the current user
    RETURN QUERY
    SELECT 
        uv.id,
        uv.invite_code,
        uv.inviter_id,
        uv.max_uses,
        uv.current_uses,
        uv.expires_at,
        uv.created_at,
        uv.updated_at,
        uv.is_active
    FROM public.user_invites_safe uv
    WHERE uv.inviter_id = auth.uid();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_invites() TO authenticated;

-- For user interface, create a policy on the safe view
CREATE POLICY "Users can view their own safe invites"
ON public.user_invites_safe
FOR SELECT
USING (auth.uid() = inviter_id);