import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Authorization required', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Get user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response('Invalid authorization', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const { videoId } = await req.json()

    if (!videoId) {
      return new Response('Video ID required', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Check if user has access to this video
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('r2_object_key, uploader_id, status')
      .eq('id', videoId)
      .single()

    if (videoError || !video) {
      return new Response('Video not found', { 
        status: 404, 
        headers: corsHeaders 
      })
    }

    if (video.status !== 'approved') {
      return new Response('Video not approved', { 
        status: 403, 
        headers: corsHeaders 
      })
    }

    // Check if user owns the video
    const isOwner = video.uploader_id === user.id

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Check if user has unlocked the video
    const { data: unlock } = await supabase
      .from('user_unlocks')
      .select('id')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .single()

    const hasUnlocked = !!unlock

    if (!isOwner && !isAdmin && !hasUnlocked) {
      return new Response('Access denied - video not unlocked', { 
        status: 403, 
        headers: corsHeaders 
      })
    }

    if (!video.r2_object_key) {
      return new Response('Video file not available', { 
        status: 404, 
        headers: corsHeaders 
      })
    }

    // Generate short-lived signed URL for R2
    const accountId = Deno.env.get('R2_ACCOUNT_ID')
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
    const bucketName = Deno.env.get('R2_BUCKET_NAME')

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return new Response('R2 credentials not configured', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    const signedUrl = await createSignedUrl(
      accountId,
      bucketName,
      video.r2_object_key,
      accessKeyId,
      secretAccessKey,
      900 // 15 minutes expiry
    )

    return new Response(JSON.stringify({
      signedUrl,
      expiresIn: 900
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Get video URL error:', error)
    return new Response(`Error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})

async function createSignedUrl(
  accountId: string,
  bucketName: string,
  objectKey: string,
  accessKeyId: string,
  secretAccessKey: string,
  expirationTime: number
): Promise<string> {
  const region = 'auto'
  const service = 's3'
  const algorithm = 'AWS4-HMAC-SHA256'

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  // Use path-style addressing for better compatibility
  const host = endpoint.replace('https://', '')
  const canonicalUri = `/${bucketName}/${objectKey}`
  
  // Build query string
  const queryString = new URLSearchParams({
    'X-Amz-Algorithm': algorithm,
    'X-Amz-Credential': `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expirationTime.toString(),
    'X-Amz-SignedHeaders': 'host'
  }).toString()

  // Create canonical request
  const canonicalHeaders = `host:${host}\n`
  const signedHeaders = 'host'
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const canonicalRequest = [
    'GET',
    canonicalUri,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')

  // Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n')

  // Calculate signature
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service)
  const signature = await hmacSha256(signingKey, stringToSign)

  // Build final URL
  const finalQueryString = `${queryString}&X-Amz-Signature=${signature}`
  return `https://${host}${canonicalUri}?${finalQueryString}`
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacSha256(key: Uint8Array, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyObject = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', keyObject, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  
  let kDate = await crypto.subtle.importKey(
    'raw',
    encoder.encode('AWS4' + key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  kDate = new Uint8Array(await crypto.subtle.sign('HMAC', kDate, encoder.encode(dateStamp)))

  let kRegion = await crypto.subtle.importKey(
    'raw',
    kDate,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  kRegion = new Uint8Array(await crypto.subtle.sign('HMAC', kRegion, encoder.encode(regionName)))

  let kService = await crypto.subtle.importKey(
    'raw',
    kRegion,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  kService = new Uint8Array(await crypto.subtle.sign('HMAC', kService, encoder.encode(serviceName)))

  let kSigning = await crypto.subtle.importKey(
    'raw',
    kService,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', kSigning, encoder.encode('aws4_request')))
}