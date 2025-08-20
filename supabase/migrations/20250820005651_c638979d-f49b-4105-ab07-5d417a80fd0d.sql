-- Add admin function to permanently delete invite codes
CREATE OR REPLACE FUNCTION public.admin_delete_invite(invite_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Check if user is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Access denied: Admin privileges required'
        );
    END IF;
    
    -- Delete the invite (cascade will handle redemptions)
    DELETE FROM public.invites
    WHERE id = invite_id_param;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invite not found'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Invite permanently deleted'
    );
END;
$function$;