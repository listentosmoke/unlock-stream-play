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

    const { inviteCode } = await req.json();

    console.log('Processing invite redemption for code:', inviteCode);

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token from authorization header
    const jwt = authHeader.replace('Bearer ', '');
    
    // Create service role client for secure operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    // Verify the JWT token and get user info
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Create client with user context for RPC call
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Use the secure database function to handle redemption atomically
    const { data, error } = await supabase.rpc('redeem_invite', {
      invite_code_param: inviteCode
    });

    if (error) {
      console.error('Database function error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to process invite redemption' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.success) {
      console.error('Redemption failed:', data.error);
      return new Response(
        JSON.stringify({ error: data.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Invite redemption successful:', data);
    
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
    console.error('Error processing invite:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process invite redemption' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});