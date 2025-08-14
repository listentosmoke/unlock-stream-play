import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create client for user operations
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { inviteCode, inviteeId } = await req.json();

    console.log('Processing invite redemption:', { inviteCode, inviteeId });

    // Get the invite and validate it
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('invite_code', inviteCode)
      .eq('is_active', true)
      .single();

    if (inviteError || !invite) {
      console.error('Invite not found or invalid:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invite code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invite is expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      console.error('Invite expired:', invite.expires_at);
      return new Response(
        JSON.stringify({ error: 'Invite code has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invite has reached max uses
    if (invite.current_uses >= invite.max_uses) {
      console.error('Invite max uses reached:', invite.current_uses, invite.max_uses);
      return new Response(
        JSON.stringify({ error: 'Invite code has reached maximum uses' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already redeemed this invite
    const { data: existingRedemption } = await supabaseAdmin
      .from('invite_redemptions')
      .select('id')
      .eq('invite_id', invite.id)
      .eq('invitee_id', inviteeId)
      .single();

    if (existingRedemption) {
      console.error('User already redeemed this invite');
      return new Response(
        JSON.stringify({ error: 'You have already used this invite code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-invitation
    if (invite.inviter_id === inviteeId) {
      console.error('Self-invitation attempt');
      return new Response(
        JSON.stringify({ error: 'You cannot use your own invite code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const inviterPoints = 50;
    const inviteePoints = 25;

    // Start transaction: Update points and create records
    const { error: transactionError } = await supabaseAdmin.rpc('begin');
    
    try {
      // Update inviter points
      const { error: inviterUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ points: invite.inviter_points + inviterPoints })
        .eq('user_id', invite.inviter_id);

      if (inviterUpdateError) {
        throw new Error(`Failed to update inviter points: ${inviterUpdateError.message}`);
      }

      // Update invitee points
      const { error: inviteeUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ points: invitee.points + inviteePoints })
        .eq('user_id', inviteeId);

      if (inviteeUpdateError) {
        throw new Error(`Failed to update invitee points: ${inviteeUpdateError.message}`);
      }

      // Create inviter transaction
      const { error: inviterTransactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: invite.inviter_id,
          type: 'referral',
          amount: inviterPoints,
          description: `Referral bonus for inviting new user`
        });

      if (inviterTransactionError) {
        throw new Error(`Failed to create inviter transaction: ${inviterTransactionError.message}`);
      }

      // Create invitee transaction
      const { error: inviteeTransactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: inviteeId,
          type: 'referral',
          amount: inviteePoints,
          description: `Welcome bonus for joining via invite`
        });

      if (inviteeTransactionError) {
        throw new Error(`Failed to create invitee transaction: ${inviteeTransactionError.message}`);
      }

      // Create redemption record
      const { error: redemptionError } = await supabaseAdmin
        .from('invite_redemptions')
        .insert({
          invite_id: invite.id,
          inviter_id: invite.inviter_id,
          invitee_id: inviteeId,
          inviter_points_awarded: inviterPoints,
          invitee_points_awarded: inviteePoints
        });

      if (redemptionError) {
        throw new Error(`Failed to create redemption record: ${redemptionError.message}`);
      }

      // Update invite usage count
      const { error: inviteUpdateError } = await supabaseAdmin
        .from('invites')
        .update({ 
          current_uses: invite.current_uses + 1,
          is_active: invite.current_uses + 1 >= invite.max_uses ? false : true
        })
        .eq('id', invite.id);

      if (inviteUpdateError) {
        throw new Error(`Failed to update invite usage: ${inviteUpdateError.message}`);
      }

      // Commit transaction
      await supabaseAdmin.rpc('commit');

      console.log('Invite redemption successful');
      
      return new Response(
        JSON.stringify({
          success: true,
          inviterPointsAwarded: inviterPoints,
          inviteePointsAwarded: inviteePoints
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      // Rollback on error
      await supabaseAdmin.rpc('rollback');
      throw error;
    }

  } catch (error) {
    console.error('Error processing invite:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process invite redemption' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});