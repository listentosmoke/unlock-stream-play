import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inviteCode } = await req.json();
    console.log('[process-invite] Starting processing for code:', inviteCode);

    // Log all relevant headers for debugging
    console.log('[process-invite] Headers received:');
    console.log('[process-invite] Authorization:', req.headers.get('Authorization'));
    console.log('[process-invite] X-Supabase-Auth:', req.headers.get('X-Supabase-Auth'));
    
    // Extract user token - Supabase SDK sends user JWT in X-Supabase-Auth header
    // and anon key in Authorization header by default
    const userToken = req.headers.get('X-Supabase-Auth') || req.headers.get('Authorization');
    console.log('[process-invite] Using token from:', req.headers.get('X-Supabase-Auth') ? 'X-Supabase-Auth' : 'Authorization');

    // Create Supabase client with the user token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${userToken?.replace('Bearer ', '')}`,
          },
        },
      }
    );

    // Verify authentication
    console.log('[process-invite] Verifying user authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[process-invite] Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-invite] User authenticated:', user.id);

    // Check if user profile exists
    console.log('[process-invite] Checking user profile exists...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, points')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('[process-invite] Profile check error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found. Please try again in a moment.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-invite] User profile found:', profile);

    // Call the secure database function
    console.log('[process-invite] Calling redeem_invite function...');
    const { data, error } = await supabase.rpc('redeem_invite', {
      invite_code_param: inviteCode
    });

    console.log('[process-invite] RPC response - data:', data, 'error:', error);

    if (error) {
      console.error('[process-invite] Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Database error', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data?.success) {
      console.error('[process-invite] Redemption failed:', data?.error);
      return new Response(
        JSON.stringify({ error: data?.error || 'Redemption failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-invite] Invite redemption successful - points awarded:', {
      inviter: data.inviter_points_awarded,
      invitee: data.invitee_points_awarded
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        inviterPointsAwarded: data.inviter_points_awarded,
        inviteePointsAwarded: data.invitee_points_awarded,
        message: data.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});