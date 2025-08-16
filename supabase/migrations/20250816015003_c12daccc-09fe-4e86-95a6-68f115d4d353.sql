-- Create database function for ensuring profile exists after signup
CREATE OR REPLACE FUNCTION public.ensure_profile_exists(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    profile_exists boolean := false;
    retry_count integer := 0;
    max_retries integer := 10;
BEGIN
    -- Check if profile exists, retry if not (for timing issues after signup)
    LOOP
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = target_user_id) INTO profile_exists;
        
        IF profile_exists THEN
            EXIT;
        END IF;
        
        retry_count := retry_count + 1;
        IF retry_count >= max_retries THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Profile not found after maximum retries. Please try again in a moment.'
            );
        END IF;
        
        -- Wait a bit before retrying
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Profile verified'
    );
END;
$$;

-- Create admin-safe function to get all invites without exposing emails
CREATE OR REPLACE FUNCTION public.get_all_invites_admin_safe()
RETURNS TABLE(
    id uuid,
    invite_code text,
    inviter_id uuid,
    max_uses integer,
    current_uses integer,
    expires_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_active boolean,
    inviter_username text,
    inviter_display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Check if user is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
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
        i.is_active,
        p.username as inviter_username,
        p.display_name as inviter_display_name
    FROM public.invites i
    LEFT JOIN public.profiles p ON p.user_id = i.inviter_id
    ORDER BY i.created_at DESC;
END;
$$;

-- Create admin function to get all redemptions with profile info
CREATE OR REPLACE FUNCTION public.get_all_redemptions_admin()
RETURNS TABLE(
    id uuid,
    invite_id uuid,
    inviter_id uuid,
    invitee_id uuid,
    inviter_points_awarded integer,
    invitee_points_awarded integer,
    redeemed_at timestamp with time zone,
    invite_code text,
    inviter_username text,
    inviter_display_name text,
    invitee_username text,
    invitee_display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Check if user is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    RETURN QUERY
    SELECT 
        ir.id,
        ir.invite_id,
        ir.inviter_id,
        ir.invitee_id,
        ir.inviter_points_awarded,
        ir.invitee_points_awarded,
        ir.redeemed_at,
        i.invite_code,
        p1.username as inviter_username,
        p1.display_name as inviter_display_name,
        p2.username as invitee_username,
        p2.display_name as invitee_display_name
    FROM public.invite_redemptions ir
    LEFT JOIN public.invites i ON i.id = ir.invite_id
    LEFT JOIN public.profiles p1 ON p1.user_id = ir.inviter_id
    LEFT JOIN public.profiles p2 ON p2.user_id = ir.invitee_id
    ORDER BY ir.redeemed_at DESC
    LIMIT 100;
END;
$$;

-- Create admin function to update invite status
CREATE OR REPLACE FUNCTION public.admin_update_invite_status(
    invite_id_param uuid,
    new_status boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Check if user is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Access denied: Admin privileges required'
        );
    END IF;
    
    -- Update invite status
    UPDATE public.invites
    SET is_active = new_status,
        updated_at = now()
    WHERE id = invite_id_param;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invite not found'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', CASE 
            WHEN new_status THEN 'Invite activated successfully'
            ELSE 'Invite deactivated successfully'
        END
    );
END;
$$;