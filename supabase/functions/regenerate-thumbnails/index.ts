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

    // Get all videos that need thumbnails
    const { data: videos, error: fetchError } = await supabase
      .from('videos')
      .select('id, title, full_video_url')
      .eq('status', 'approved')

    if (fetchError) {
      throw fetchError
    }

    console.log(`Found ${videos?.length || 0} videos to process`)

    let processed = 0
    const results = []

    for (const video of videos || []) {
      try {
        // Call the generate-thumbnail function
        const { data, error } = await supabase.functions.invoke('generate-thumbnail', {
          body: {
            videoId: video.id,
            videoUrl: video.full_video_url
          }
        })

        if (error) {
          throw error
        }

        results.push({
          videoId: video.id,
          title: video.title,
          success: true,
          thumbnailUrl: data?.thumbnailUrl
        })
        processed++

      } catch (error) {
        console.error(`Error processing video ${video.id}:`, error)
        results.push({
          videoId: video.id,
          title: video.title,
          success: false,
          error: error.message
        })
      }
    }

    console.log(`Processed ${processed} videos successfully`)

    return new Response(
      JSON.stringify({ 
        success: true,
        processed,
        total: videos?.length || 0,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in batch thumbnail generation:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})