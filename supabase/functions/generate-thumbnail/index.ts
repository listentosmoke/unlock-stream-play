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

    const { videoId, videoUrl } = await req.json()
    
    if (!videoId || !videoUrl) {
      return new Response(
        JSON.stringify({ error: 'videoId and videoUrl are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Generating thumbnail for video:', videoId)

    // Create a PNG thumbnail
    const pngBuffer = createPNGThumbnail(videoId)
    
    // Upload thumbnail to storage
    const thumbnailFileName = `${videoId}-thumbnail.png`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(`thumbnails/${thumbnailFileName}`, pngBuffer, {
        contentType: 'image/png',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error(`Failed to upload thumbnail: ${uploadError.message}`)
    }

    console.log('Thumbnail uploaded successfully:', uploadData)

    // Get public URL for thumbnail
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(`thumbnails/${thumbnailFileName}`)

    console.log('Thumbnail public URL:', publicUrl)

    // Update video record with thumbnail URL
    const { error: updateError } = await supabase
      .from('videos')
      .update({ thumbnail_url: publicUrl })
      .eq('id', videoId)

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error(`Failed to update video record: ${updateError.message}`)
    }

    console.log('Video record updated successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnailUrl: publicUrl 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error generating thumbnail:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function createPNGThumbnail(videoId: string): Uint8Array {
  // Generate colors based on video ID
  let hash = 0
  for (let i = 0; i < videoId.length; i++) {
    hash = videoId.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const hue1 = Math.abs(hash) % 360
  const hue2 = (hue1 + 60) % 360
  
  const rgb1 = hslToRgb(hue1 / 360, 0.7, 0.5)
  const rgb2 = hslToRgb(hue2 / 360, 0.7, 0.3)
  
  // Create a simple PNG using manual PNG construction
  const width = 640
  const height = 360
  
  // Create image data array (RGBA)
  const imageData = new Uint8Array(width * height * 4)
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      
      // Create gradient effect
      const gradientFactor = (x + y) / (width + height)
      const r = Math.floor(rgb1[0] * (1 - gradientFactor) + rgb2[0] * gradientFactor)
      const g = Math.floor(rgb1[1] * (1 - gradientFactor) + rgb2[1] * gradientFactor)
      const b = Math.floor(rgb1[2] * (1 - gradientFactor) + rgb2[2] * gradientFactor)
      
      // Add play button circle in center
      const centerX = width / 2
      const centerY = height / 2
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
      
      if (distance <= 50) {
        // Dark circle for play button
        imageData[index] = 0
        imageData[index + 1] = 0
        imageData[index + 2] = 0
        imageData[index + 3] = 180
        
        // White triangle (simplified)
        if (x > centerX - 20 && x < centerX + 20 && y > centerY - 15 && y < centerY + 15) {
          const triangleX = x - (centerX - 20)
          const triangleY = y - (centerY - 15)
          if (triangleX > triangleY * 0.75 && triangleX > (30 - triangleY) * 0.75) {
            imageData[index] = 255
            imageData[index + 1] = 255
            imageData[index + 2] = 255
            imageData[index + 3] = 255
          }
        }
      } else {
        imageData[index] = r
        imageData[index + 1] = g
        imageData[index + 2] = b
        imageData[index + 3] = 255
      }
    }
  }
  
  // Create a basic PNG - this is a simplified implementation
  // In a real scenario, you'd use a proper PNG encoding library
  // For now, we'll create a BMP format which is simpler
  return createBMP(imageData, width, height)
}

function createBMP(imageData: Uint8Array, width: number, height: number): Uint8Array {
  const rowPadding = (4 - ((width * 3) % 4)) % 4
  const pixelArraySize = (width * 3 + rowPadding) * height
  const fileSize = 54 + pixelArraySize
  
  const bmp = new Uint8Array(fileSize)
  const view = new DataView(bmp.buffer)
  
  // BMP Header
  view.setUint16(0, 0x424D, true) // BM signature
  view.setUint32(2, fileSize, true) // File size
  view.setUint32(10, 54, true) // Pixel data offset
  
  // DIB Header
  view.setUint32(14, 40, true) // DIB header size
  view.setInt32(18, width, true) // Width
  view.setInt32(22, -height, true) // Height (negative for top-down)
  view.setUint16(26, 1, true) // Planes
  view.setUint16(28, 24, true) // Bits per pixel
  view.setUint32(34, pixelArraySize, true) // Pixel array size
  
  // Pixel data (BGR format for BMP)
  let dataIndex = 54
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = (y * width + x) * 4
      bmp[dataIndex++] = imageData[srcIndex + 2] // B
      bmp[dataIndex++] = imageData[srcIndex + 1] // G
      bmp[dataIndex++] = imageData[srcIndex] // R
    }
    // Add row padding
    for (let p = 0; p < rowPadding; p++) {
      bmp[dataIndex++] = 0
    }
  }
  
  return bmp
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b
  
  if (s === 0) {
    r = g = b = l // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}