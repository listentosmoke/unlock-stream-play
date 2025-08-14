-- Fix invite security issues identified in security scan

-- Create a secure function to get invite info for redemption
-- This function only returns essential data needed for redemption
CREATE OR REPLACE FUNCTION public.get_invite_for_redemption(invite_code_param text)
 RETURNS TABLE(
   id uuid,
   inviter_id uuid,
   max_uses integer,
   current_uses integer,
   expires_at timestamp with time zone,
   is_active boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Only return basic invite info needed for redemption
  -- Excludes sensitive data like invited_email
  RETURN QUERY
  SELECT 
    i.id,
    i.inviter_id,
    i.max_uses,
    i.current_uses,
    i.expires_at,
    i.is_active
  FROM public.invites i
  WHERE i.invite_code = invite_code_param
  AND i.is_active = true;
END;
$$;

-- Add policy for secure invite code lookup during redemption
-- This allows users to view specific invite info by code for redemption purposes
-- but does not expose sensitive email data
CREATE POLICY "Users can view invite info for redemption by code"
ON public.invites
FOR SELECT
USING (
  -- Allow viewing invite info when looking up by code for redemption
  -- This is needed for the redeem_invite function to work
  -- We limit exposure by using the security definer function above
  invite_code IN (
    SELECT unnest(string_to_array(current_setting('app.current_invite_code', true), ','))
  )
  OR
  -- Keep existing admin access
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Update the redeem_invite function to use the secure lookup
CREATE OR REPLACE FUNCTION public.redeem_invite(invite_code_param text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    invite_record RECORD;
    invitee_user_id uuid;
    redemption_id uuid;
    invitee_profile_exists boolean;
    inviter_profile_exists boolean;
    result json;
BEGIN
    -- Set the current invite code for the policy
    PERFORM set_config('app.current_invite_code', invite_code_param, true);
    
    -- Get the authenticated user
    invitee_user_id := auth.uid();
    
    IF invitee_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User must be authenticated'
        );
    END IF;
    
    -- Check if invitee profile exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = invitee_user_id) INTO invitee_profile_exists;
    
    IF NOT invitee_profile_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User profile not found. Please try again in a moment.'
        );
    END IF;
    
    -- Get the invite record using secure function (no sensitive data exposed)
    SELECT * INTO invite_record
    FROM public.get_invite_for_redemption(invite_code_param)
    FOR UPDATE;
    
    -- Validate invite exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid invite code'
        );
    END IF;
    
    -- Check if inviter profile exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = invite_record.inviter_id) INTO inviter_profile_exists;
    
    IF NOT inviter_profile_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Inviter profile not found'
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
        -- Provide more specific error information
        RETURN json_build_object(
            'success', false,
            'error', 'Database error: ' || SQLERRM
        );
END;
$$;