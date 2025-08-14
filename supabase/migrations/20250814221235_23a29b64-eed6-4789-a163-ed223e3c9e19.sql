-- Create a function to safely delete a user and all related data
CREATE OR REPLACE FUNCTION public.delete_user_cascade(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Prevent admin from deleting themselves
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete your own account';
    END IF;
    
    -- Delete related data in correct order to avoid constraint violations
    
    -- 1. Delete invite redemptions where user was inviter or invitee
    DELETE FROM public.invite_redemptions 
    WHERE inviter_id = target_user_id OR invitee_id = target_user_id;
    
    -- 2. Delete user unlocks
    DELETE FROM public.user_unlocks 
    WHERE user_id = target_user_id;
    
    -- 3. Delete transactions
    DELETE FROM public.transactions 
    WHERE user_id = target_user_id;
    
    -- 4. Delete gift cards (submitted or redeemed by user)
    DELETE FROM public.gift_cards 
    WHERE submitted_by = target_user_id OR redeemed_by = target_user_id;
    
    -- 5. Delete videos uploaded by user
    DELETE FROM public.videos 
    WHERE uploader_id = target_user_id;
    
    -- 6. Delete invites created by user
    DELETE FROM public.invites 
    WHERE inviter_id = target_user_id;
    
    -- 7. Finally delete the profile
    DELETE FROM public.profiles 
    WHERE user_id = target_user_id;
    
    -- Note: The auth user should be deleted separately using supabase.auth.admin.deleteUser()
    -- This is because auth deletion requires service role key which isn't available in database functions
END;
$$;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(uuid) TO authenticated;