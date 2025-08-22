import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the uploaded file from the form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Uploading file to Catbox: ${file.name}, size: ${file.size} bytes`)

    // Create form data for Catbox API
    const catboxFormData = new FormData()
    catboxFormData.append('reqtype', 'fileupload')
    catboxFormData.append('fileToUpload', file)

    // Upload to Catbox with fetch (more memory efficient than loading entire file)
    const catboxResponse = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: catboxFormData,
    })

    if (!catboxResponse.ok) {
      throw new Error(`Catbox API error: ${catboxResponse.status}`)
    }

    const catboxUrl = await catboxResponse.text()
    
    // Validate the response is a proper Catbox URL
    if (!catboxUrl.trim().startsWith('https://files.catbox.moe/')) {
      throw new Error(`Invalid Catbox response: ${catboxUrl}`)
    }

    console.log(`File uploaded successfully to Catbox: ${catboxUrl}`)

    return new Response(JSON.stringify({ 
      success: true, 
      url: catboxUrl.trim() 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error uploading to Catbox:', error)
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to upload file' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})