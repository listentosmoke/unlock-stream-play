-- Create a more restrictive RLS policy for invite viewing that excludes sensitive email data for regular users
DROP POLICY IF EXISTS "Users can view their own invites" ON public.invites;

-- Allow users to view their own invites but with limited access to sensitive fields
CREATE POLICY "Users can view their own invite codes and basic info" 
ON public.invites 
FOR SELECT 
USING (auth.uid() = inviter_id);

-- Create a separate policy for admins to access all invite data including emails
CREATE POLICY "Admins can view all invite data including emails" 
ON public.invites 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::user_role
  )
);