import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { action, fileName, fileType, fileSize, uploadId, partNumber, parts, objectKey: clientObjectKey } = await req.json()

    const accountId = Deno.env.get('R2_ACCOUNT_ID')
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
    const bucketName = Deno.env.get('R2_BUCKET_NAME')

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('R2 credentials missing:', { accountId: !!accountId, accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey, bucketName: !!bucketName })
      return new Response('R2 credentials not configured', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
    // Use client-provided objectKey for operations that need it, generate new one for initial uploads
    const objectKey = clientObjectKey || `${Date.now()}-${fileName}`
    
    console.log('R2 presign request:', { action, fileName, objectKey, fileSize })

    switch (action) {
      case 'simple-upload': {
        // Generate presigned URL for simple PUT upload
        const presignedUrl = await createPresignedUrl(
          endpoint, 
          bucketName, 
          objectKey, 
          accessKeyId, 
          secretAccessKey,
          'PUT',
          fileType
        )
        
        return new Response(JSON.stringify({
          presignedUrl,
          objectKey,
          publicUrl: `${endpoint}/${bucketName}/${objectKey}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'initiate-multipart': {
        // Initiate multipart upload
        const initiateUrl = await createPresignedUrl(
          endpoint, 
          bucketName, 
          objectKey, 
          accessKeyId, 
          secretAccessKey,
          'POST',
          fileType,
          { uploads: '' }
        )

        const response = await fetch(initiateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': fileType
          }
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Multipart initiate failed:', response.status, errorText)
          throw new Error(`Failed to initiate multipart upload: ${response.status} ${response.statusText}`)
        }

        const xmlText = await response.text()
        console.log('Initiate multipart response:', xmlText)
        
        const uploadIdMatch = xmlText.match(/<UploadId>([^<]+)<\/UploadId>/)
        const extractedUploadId = uploadIdMatch ? uploadIdMatch[1] : null

        if (!extractedUploadId) {
          console.error('No UploadId found in response:', xmlText)
          throw new Error('Failed to parse upload ID from multipart initiate response')
        }

        return new Response(JSON.stringify({
          uploadId: extractedUploadId,
          objectKey
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'get-part-url': {
        // Generate presigned URL for uploading a part
        const partUrl = await createPresignedUrl(
          endpoint, 
          bucketName, 
          objectKey, 
          accessKeyId, 
          secretAccessKey,
          'PUT',
          null,
          { 
            partNumber: partNumber.toString(),
            uploadId 
          }
        )

        return new Response(JSON.stringify({
          presignedUrl: partUrl
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'complete-multipart': {
        // Complete multipart upload
        const completeUrl = await createPresignedUrl(
          endpoint, 
          bucketName, 
          objectKey, 
          accessKeyId, 
          secretAccessKey,
          'POST',
          null,
          { uploadId }
        )

        const partsXml = parts.map((part: any) => 
          `<Part><PartNumber>${part.PartNumber}</PartNumber><ETag>${part.ETag}</ETag></Part>`
        ).join('')
        
        const completeXml = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`

        const response = await fetch(completeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml'
          },
          body: completeXml
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Complete multipart failed:', response.status, errorText)
          throw new Error(`Failed to complete multipart upload: ${response.status} ${response.statusText}`)
        }

        return new Response(JSON.stringify({
          publicUrl: `${endpoint}/${bucketName}/${objectKey}`,
          objectKey
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'abort-multipart': {
        // Abort multipart upload
        const abortUrl = await createPresignedUrl(
          endpoint, 
          bucketName, 
          objectKey, 
          accessKeyId, 
          secretAccessKey,
          'DELETE',
          null,
          { uploadId }
        )

        await fetch(abortUrl, { method: 'DELETE' })

        return new Response(JSON.stringify({
          success: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response('Invalid action', { 
          status: 400, 
          headers: corsHeaders 
        })
    }
  } catch (error) {
    console.error('R2 presign error:', error)
    return new Response(`Error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})

async function createPresignedUrl(
  endpoint: string,
  bucketName: string,
  objectKey: string,
  accessKeyId: string,
  secretAccessKey: string,
  method: string,
  contentType?: string | null,
  queryParams?: Record<string, string>
): Promise<string> {
  const region = 'auto'
  const service = 's3'
  const algorithm = 'AWS4-HMAC-SHA256'
  const expirationTime = 3600 // 1 hour

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  // Use path-style addressing for better compatibility
  const host = endpoint.replace('https://', '')
  const canonicalUri = `/${bucketName}/${objectKey}`
  
  // Build query string
  const queryString = new URLSearchParams({
    'X-Amz-Algorithm': algorithm,
    'X-Amz-Credential': `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expirationTime.toString(),
    'X-Amz-SignedHeaders': 'host',
    ...queryParams
  }).toString()

  // Create canonical request
  const canonicalHeaders = `host:${host}\n`
  const signedHeaders = 'host'
  const payloadHash = 'UNSIGNED-PAYLOAD'

  const canonicalRequest = [
    method,
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