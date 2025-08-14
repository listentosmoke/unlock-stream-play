-- Implement proper column-level security for invites table
-- Create a view and function to exclude invited_email from regular user access

-- Create a view for user-safe invite data (excluding invited_email)
CREATE OR REPLACE VIEW public.user_invites AS
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
FROM public.invites;

-- Enable RLS on the view
ALTER VIEW public.user_invites ENABLE ROW LEVEL SECURITY;

-- Create policy for the view - users can only see their own invites
CREATE POLICY "Users can view their own invites via view" 
ON public.user_invites 
FOR SELECT 
USING (auth.uid() = inviter_id);

-- Update the original table policy to be more restrictive for regular users
-- Only allow admin access to the full table with emails
DROP POLICY "Users can view their own invites excluding emails" ON public.invites;

CREATE POLICY "Only admins can access full invite data" 
ON public.invites 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'::user_role
));