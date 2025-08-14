-- Remove the insecure INSERT policy
DROP POLICY "Users can create invite redemptions for valid invites" ON public.invite_redemptions;

-- Create a secure invite redemption function that handles all business logic atomically
CREATE OR REPLACE FUNCTION public.redeem_invite(invite_code_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    invite_record public.invites%ROWTYPE;
    invitee_user_id uuid;
    redemption_id uuid;
    result json;
BEGIN
    -- Get the authenticated user
    invitee_user_id := auth.uid();
    
    IF invitee_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User must be authenticated'
        );
    END IF;
    
    -- Get the invite record with row locking to prevent race conditions
    SELECT * INTO invite_record
    FROM public.invites
    WHERE invite_code = invite_code_param
    FOR UPDATE;
    
    -- Validate invite exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid invite code'
        );
    END IF;
    
    -- Validate invite is active
    IF NOT invite_record.is_active THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invite is no longer active'
        );
    END IF;
    
    -- Validate invite hasn't expired
    IF invite_record.expires_at IS NOT NULL AND invite_record.expires_at <= now() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invite has expired'
        );
    END IF;
    
    -- Validate invite has remaining uses
    IF invite_record.current_uses >= invite_record.max_uses THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invite has reached maximum uses'
        );
    END IF;
    
    -- Prevent users from redeeming their own invites
    IF invite_record.inviter_id = invitee_user_id THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Cannot redeem your own invite'
        );
    END IF;
    
    -- Check if user already redeemed this invite
    IF EXISTS (
        SELECT 1 FROM public.invite_redemptions
        WHERE invite_id = invite_record.id
        AND invitee_id = invitee_user_id
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'You have already redeemed this invite'
        );
    END IF;
    
    -- All validations passed, proceed with redemption
    
    -- 1. Create the redemption record
    INSERT INTO public.invite_redemptions (
        invite_id,
        inviter_id,
        invitee_id,
        inviter_points_awarded,
        invitee_points_awarded
    ) VALUES (
        invite_record.id,
        invite_record.inviter_id,
        invitee_user_id,
        50, -- Standard inviter reward
        25  -- Standard invitee reward
    ) RETURNING id INTO redemption_id;
    
    -- 2. Update invite usage count
    UPDATE public.invites
    SET current_uses = current_uses + 1,
        updated_at = now()
    WHERE id = invite_record.id;
    
    -- 3. Award points to inviter
    UPDATE public.profiles
    SET points = points + 50,
        updated_at = now()
    WHERE user_id = invite_record.inviter_id;
    
    -- 4. Award points to invitee
    UPDATE public.profiles
    SET points = points + 25,
        updated_at = now()
    WHERE user_id = invitee_user_id;
    
    -- 5. Create transaction records for point awards
    INSERT INTO public.transactions (user_id, amount, type, description) VALUES
    (invite_record.inviter_id, 50, 'invite_reward', 'Points earned for successful invite'),
    (invitee_user_id, 25, 'invite_bonus', 'Welcome bonus for joining via invite');
    
    -- Return success with redemption details
    RETURN json_build_object(
        'success', true,
        'redemption_id', redemption_id,
        'inviter_points_awarded', 50,
        'invitee_points_awarded', 25,
        'message', 'Invite successfully redeemed! Welcome bonus points added to your account.'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback happens automatically due to exception
        RETURN json_build_object(
            'success', false,
            'error', 'An unexpected error occurred during redemption'
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;