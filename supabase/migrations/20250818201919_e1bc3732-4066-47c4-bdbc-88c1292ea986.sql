
-- 1) Fix enum mismatch by updating redeem_invite to use existing enum value 'reward'
-- This preserves all logic; only changes the transaction type values inserted.
CREATE OR REPLACE FUNCTION public.redeem_invite(invite_code_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    invite_record RECORD;
    invitee_user_id uuid;
    redemption_id uuid;
    invitee_profile_exists boolean;
    inviter_profile_exists boolean;
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
    FROM public.get_invite_for_redemption(invite_code_param);
    
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
    -- Use existing enum value 'reward' for both rows to match transaction_type
    INSERT INTO public.transactions (user_id, amount, type, description) VALUES
    (invite_record.inviter_id, 50, 'reward'::transaction_type, 'Points earned for successful invite'),
    (invitee_user_id, 25, 'reward'::transaction_type, 'Welcome bonus for joining via invite');
    
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
        RETURN json_build_object(
            'success', false,
            'error', 'Database error: ' || SQLERRM
        );
END;
$function$;

-- 2) Add user SELECT policies for invites
-- Allows users to see their own invites
CREATE POLICY "Users can view their own invites (select)"
ON public.invites
FOR SELECT
USING (auth.uid() = inviter_id);

-- Allows users to select invites tied to their redemptions (enables PostgREST joins)
CREATE POLICY "Users can view invites tied to their redemptions"
ON public.invites
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.invite_redemptions ir
    WHERE ir.invite_id = invites.id
      AND (ir.inviter_id = auth.uid() OR ir.invitee_id = auth.uid())
  )
);

-- 3) Optional: Add helper RPC for user redemptions with invite_code to avoid client-side joins
CREATE OR REPLACE FUNCTION public.get_my_redemptions()
RETURNS TABLE(
  id uuid,
  invite_id uuid,
  inviter_id uuid,
  invitee_id uuid,
  inviter_points_awarded integer,
  invitee_points_awarded integer,
  redeemed_at timestamptz,
  invite_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: User not authenticated';
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
    i.invite_code
  FROM public.invite_redemptions ir
  LEFT JOIN public.invites i ON i.id = ir.invite_id
  WHERE ir.inviter_id = auth.uid() OR ir.invitee_id = auth.uid()
  ORDER BY ir.redeemed_at DESC
  LIMIT 100;
END;
$function$;
