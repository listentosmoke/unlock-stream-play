-- COMPREHENSIVE SECURITY FIX FOR EMAIL EXPOSURE
-- This migration completely secures email addresses and implements proper role management

-- 1. Create proper role enum and user_roles table (following security best practices)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create secure role checking function (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 3. Migrate existing admin users from profiles table to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM public.profiles 
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

-- Insert default user role for all existing users who don't have admin
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'user'::app_role
FROM public.profiles 
WHERE role = 'user' OR role IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. COMPLETELY SECURE THE INVITES TABLE
-- Drop all existing policies that could expose emails
DROP POLICY IF EXISTS "Users can view their own invites without email" ON public.invites;
DROP POLICY IF EXISTS "Admins can view all invites with full data" ON public.invites;
DROP POLICY IF EXISTS "Users can create their own invites" ON public.invites;
DROP POLICY IF EXISTS "Users can update their own invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can view all invite data including emails" ON public.invites;
DROP POLICY IF EXISTS "Admins can view all invites" ON public.invites;

-- Create ultra-secure policies using the new role system
-- CRITICAL: These policies prevent ANY direct access to the invites table with emails

-- Policy 1: Allow admins to do everything (with emails)
CREATE POLICY "Admins full access to invites"
ON public.invites
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy 2: Allow users to INSERT their own invites (without accessing existing emails)
CREATE POLICY "Users can create invites"
ON public.invites
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = inviter_id);

-- Policy 3: Allow users to UPDATE only their own invites (but can't see emails of others)
CREATE POLICY "Users can update own invites"
ON public.invites
FOR UPDATE
TO authenticated
USING (auth.uid() = inviter_id AND public.has_role(auth.uid(), 'user'))
WITH CHECK (auth.uid() = inviter_id);

-- NO SELECT POLICY FOR REGULAR USERS - they must use the secure functions

-- 5. Update the secure functions to use new role system
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
    -- This function bypasses RLS using SECURITY DEFINER
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

-- 6. Update admin function to use new role system
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
    -- Check if user is admin using new role system
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Return all invite data including emails for admins only
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

-- 7. Update other security functions to use new role system
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.has_role(user_id_param, 'admin');
END;
$function$;

-- 8. Update profiles policies to use new role system
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 9. Create policy for user_roles table
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;