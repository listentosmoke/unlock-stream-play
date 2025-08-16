import { supabase } from "@/integrations/supabase/client";

export interface InviteRedemptionResult {
  success: boolean;
  error?: string;
  redemption_id?: string;
  inviter_points_awarded?: number;
  invitee_points_awarded?: number;
  message?: string;
}

export interface InviterInfo {
  display_name: string | null;
  username: string | null;
}

export interface InviteValidationResult {
  valid: boolean;
  error?: string;
  inviter?: InviterInfo;
}

/**
 * Ensures user profile exists with retry logic
 */
export const ensureProfileExists = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase
      .rpc('ensure_profile_exists', { target_user_id: userId });

    if (error) {
      console.error('Error ensuring profile exists:', error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string; message?: string };
    return result;
  } catch (error) {
    console.error('Exception ensuring profile exists:', error);
    return { success: false, error: 'Failed to verify profile' };
  }
};

/**
 * Validates invite code and returns inviter info
 */
export const validateInviteCode = async (inviteCode: string): Promise<InviteValidationResult> => {
  try {
    const { data, error } = await supabase
      .rpc('validate_invite_code', { code_to_check: inviteCode });

    if (error) {
      console.error('Error validating invite code:', error);
      return { valid: false, error: error.message };
    }

    const result = data as unknown as InviteValidationResult;
    return result;
  } catch (error) {
    console.error('Exception validating invite code:', error);
    return { valid: false, error: 'Failed to validate invite code' };
  }
};

/**
 * Gets public inviter information for an invite code
 */
export const getInviterPublicInfo = async (inviteCode: string): Promise<InviterInfo | null> => {
  try {
    const { data, error } = await supabase
      .rpc('get_inviter_public_info', { invite_code_param: inviteCode });

    if (error) {
      console.error('Error getting inviter info:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as InviterInfo;
  } catch (error) {
    console.error('Exception getting inviter info:', error);
    return null;
  }
};

/**
 * Redeems an invite code for the authenticated user
 */
export const redeemInviteCode = async (inviteCode: string): Promise<InviteRedemptionResult> => {
  try {
    // First ensure the current user's profile exists
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const profileCheck = await ensureProfileExists(user.id);
    if (!profileCheck.success) {
      return { success: false, error: profileCheck.error };
    }

    // Now redeem the invite
    const { data, error } = await supabase
      .rpc('redeem_invite', { invite_code_param: inviteCode });

    if (error) {
      console.error('Error redeeming invite:', error);
      return { success: false, error: error.message };
    }

    const result = data as unknown as InviteRedemptionResult;
    return result;
  } catch (error) {
    console.error('Exception redeeming invite:', error);
    return { success: false, error: 'Failed to redeem invite' };
  }
};

/**
 * Admin function to get all invites with inviter info
 */
export const getAllInvitesAdmin = async () => {
  try {
    const { data, error } = await supabase
      .rpc('get_all_invites_admin_safe');

    if (error) {
      console.error('Error getting admin invites:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Exception getting admin invites:', error);
    throw error;
  }
};

/**
 * Admin function to get all redemptions with profile info
 */
export const getAllRedemptionsAdmin = async () => {
  try {
    const { data, error } = await supabase
      .rpc('get_all_redemptions_admin');

    if (error) {
      console.error('Error getting admin redemptions:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Exception getting admin redemptions:', error);
    throw error;
  }
};

/**
 * Admin function to update invite status
 */
export const updateInviteStatus = async (inviteId: string, isActive: boolean): Promise<{ success: boolean; error?: string; message?: string }> => {
  try {
    const { data, error } = await supabase
      .rpc('admin_update_invite_status', { 
        invite_id_param: inviteId, 
        new_status: isActive 
      });

    if (error) {
      console.error('Error updating invite status:', error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string; message?: string };
    return result;
  } catch (error) {
    console.error('Exception updating invite status:', error);
    return { success: false, error: 'Failed to update invite status' };
  }
};