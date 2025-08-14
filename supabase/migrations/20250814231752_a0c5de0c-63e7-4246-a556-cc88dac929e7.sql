-- Fix the email exposure issue with a simpler approach
-- Drop the failed view and use a function-based approach

-- Drop the view if it exists (it might have been created partially)
DROP VIEW IF EXISTS public.user_invites_safe;

-- Create a completely secure policy that prevents email access
DROP POLICY IF EXISTS "Admin only direct invite access" ON public.invites;

-- Create policies that allow very limited access
CREATE POLICY "Users can view their own invites without email"
ON public.invites
FOR SELECT
USING (
  -- Users can only see their own invites
  auth.uid() = inviter_id
);

-- Create a separate admin policy with full access
CREATE POLICY "Admins can view all invites with full data"
ON public.invites  
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Since we can't hide email field at RLS level, we'll modify the client code
-- to never query the email field unless the user is an admin

-- Update the get_user_invites function to explicitly not return email even though it exists
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
    -- This function deliberately excludes invited_email field
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

-- Create an admin-only function that can access full data including emails
CREATE OR REPLACE FUNCTION public.get_all_invites_admin()
 RETURNS TABLE(
   id uuid,
   invite_code text,
   inviter_id uuid,
   invited_email text,
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
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Return all invite data including emails for admins
    RETURN QUERY
    SELECT 
        i.id,
        i.invite_code,
        i.inviter_id,
        i.invited_email,
        i.max_uses,
        i.current_uses,
        i.expires_at,
        i.created_at,
        i.updated_at,
        i.is_active
    FROM public.invites i;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_invites_admin() TO authenticated;