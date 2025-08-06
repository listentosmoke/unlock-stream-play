import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting manual thumbnail test...')

    // Get the latest video
    const { data: videos, error: fetchError } = await supabase
      .from('videos')
      .select('id, title, full_video_url')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      throw fetchError
    }

    if (!videos || videos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No videos found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const video = videos[0]
    console.log('Processing video:', video.id, video.title)

    // Call the generate-thumbnail function
    const { data, error } = await supabase.functions.invoke('generate-thumbnail', {
      body: {
        videoId: video.id,
        videoUrl: video.full_video_url
      }
    })

    console.log('Function response:', { data, error })

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        video: video,
        result: data
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in test function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})