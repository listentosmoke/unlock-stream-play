-- Create a secure function to create user invites
CREATE OR REPLACE FUNCTION public.create_user_invite()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    current_user_id uuid;
    new_invite_code text;
    invite_record public.invites%ROWTYPE;
BEGIN
    -- Get the authenticated user
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User must be authenticated'
        );
    END IF;
    
    -- Check if user already has an invite
    SELECT * INTO invite_record
    FROM public.invites
    WHERE inviter_id = current_user_id
    LIMIT 1;
    
    -- If user already has an invite, return it
    IF FOUND THEN
        RETURN json_build_object(
            'success', true,
            'invite', row_to_json(invite_record),
            'message', 'Existing invite found'
        );
    END IF;
    
    -- Generate a new invite code
    SELECT generate_invite_code() INTO new_invite_code;
    
    -- Create the invite
    INSERT INTO public.invites (
        invite_code,
        inviter_id,
        max_uses,
        is_active
    ) VALUES (
        new_invite_code,
        current_user_id,
        999999,
        true
    ) RETURNING * INTO invite_record;
    
    -- Return success with the new invite
    RETURN json_build_object(
        'success', true,
        'invite', row_to_json(invite_record),
        'message', 'New invite created successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to create invite: ' || SQLERRM
        );
END;
$function$;