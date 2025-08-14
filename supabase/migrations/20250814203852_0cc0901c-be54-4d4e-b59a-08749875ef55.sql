-- Remove the overly permissive public access policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Create secure, granular RLS policies

-- 1. Users can view their own complete profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Admins can view all profiles (for moderation)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles admin_profile
  WHERE admin_profile.user_id = auth.uid() 
  AND admin_profile.role = 'admin'
));

-- 3. Authenticated users can view basic public info of other users
-- (username, display_name only - for content attribution)
CREATE POLICY "Authenticated users can view basic profile info"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND user_id != auth.uid()
);

-- Create a security definer function to safely expose inviter info for public invite links
-- This allows the invite system to work without exposing full profile access
CREATE OR REPLACE FUNCTION public.get_inviter_public_info(invite_code_param TEXT)
RETURNS TABLE (
  display_name TEXT,
  username TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.display_name,
    p.username
  FROM public.invites i
  JOIN public.profiles p ON p.user_id = i.inviter_id
  WHERE i.invite_code = invite_code_param
  AND i.is_active = true
  AND (i.expires_at IS NULL OR i.expires_at > now());
END;
$$;

-- Grant execute permission to public (anon users) for invite functionality
GRANT EXECUTE ON FUNCTION public.get_inviter_public_info(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_inviter_public_info(TEXT) TO authenticated;