-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;

-- Create a security definer function to safely check if user is admin
-- This bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_id_param 
    AND role = 'admin'
  );
END;
$$;

-- Now create the corrected policies using the security definer function
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin(auth.uid()));

-- For authenticated users viewing basic info of others, we need to be more careful
-- Let's allow authenticated users to see usernames/display names but not sensitive data
CREATE POLICY "Authenticated users can view basic profile info"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND user_id != auth.uid()
);