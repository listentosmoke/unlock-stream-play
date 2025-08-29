import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const DEBUG = (Deno.env.get('DEBUG_SIGV4') || '').toLowerCase() === 'true';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response(null, {
    headers: corsHeaders
  });
  if (req.method !== 'POST') return new Response('Method not allowed', {
    status: 405,
    headers: corsHeaders
  });
  try {
    const body = await req.json().catch(()=>({}));
    const { action, fileName, fileType, fileSize, uploadId, partNumber, parts, objectKey: clientObjectKey } = body;
    // Load R2 credentials
    const accountId = (Deno.env.get('R2_ACCOUNT_ID') || '').trim();
    const accessKeyId = (Deno.env.get('R2_ACCESS_KEY_ID') || '').trim();
    const secretAccessKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') || '').trim();
    const bucketName = (Deno.env.get('R2_BUCKET_NAME') || '').trim();
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      console.error('Missing R2 credentials');
      return new Response('R2 credentials not configured', {
        status: 500,
        headers: corsHeaders
      });
    }
    const endpoint = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com`;
    const objectKey = clientObjectKey || `${Date.now()}-${fileName || 'file'}`;
    switch(action){
      case 'simple-upload':
        {
          const presignedUrl = await createPresignedUrl(endpoint, objectKey, accessKeyId, secretAccessKey, 'PUT', {});
          return json({
            presignedUrl,
            objectKey,
            publicUrl: `${endpoint}/${objectKey}`
          });
        }
      case 'initiate-multipart':
        {
          // Create presigned URL with ?uploads= (empty string → uploads=)
          const url = await createPresignedUrl(endpoint, objectKey, accessKeyId, secretAccessKey, 'POST', {
            uploads: ''
          });
          // Set Content-Type header to persist metadata
          const headers = {};
          if (fileType) headers['Content-Type'] = fileType;
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: ''
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to initiate multipart upload: ${res.status} ${res.statusText} - ${errorText}`);
          }
          const xml = await res.text();
          const match = xml.match(/<UploadId>([^<]+)<\/UploadId>/);
          if (!match) throw new Error('Failed to parse upload ID');
          return json({
            uploadId: match[1],
            objectKey
          });
        }
      case 'get-part-url':
        {
          if (!uploadId || !partNumber) return bad('Missing uploadId or partNumber');
          const url = await createPresignedUrl(endpoint, objectKey, accessKeyId, secretAccessKey, 'PUT', {
            partNumber: String(partNumber),
            uploadId
          });
          return json({
            presignedUrl: url
          });
        }
      case 'complete-multipart':
        {
          if (!uploadId || !Array.isArray(parts)) return bad('Missing uploadId or parts');
          const url = await createPresignedUrl(endpoint, objectKey, accessKeyId, secretAccessKey, 'POST', {
            uploadId
          });
          const partsXml = parts.map((p)=>`<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`).join('');
          const completeXml = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml'
            },
            body: completeXml
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to complete multipart upload: ${res.status} ${res.statusText} - ${errorText}`);
          }
          return json({
            publicUrl: `${endpoint}/${objectKey}`,
            objectKey
          });
        }
      case 'abort-multipart':
        {
          if (!uploadId) return bad('Missing uploadId');
          const url = await createPresignedUrl(endpoint, objectKey, accessKeyId, secretAccessKey, 'DELETE', {
            uploadId
          });
          await fetch(url, {
            method: 'DELETE'
          });
          return json({
            success: true
          });
        }
      case 'diagnose':
        {
          const url = await createPresignedUrl(endpoint, '', accessKeyId, secretAccessKey, 'GET', {
            'list-type': '2',
            'max-keys': '0'
          });
          const res = await fetch(url, {
            method: 'GET'
          });
          const text = await res.text();
          return json({
            status: res.status,
            statusText: res.statusText,
            bodyPreview: text.slice(0, 400)
          });
        }
      case 'get-object':
      case 'get-read-url':
        {
          if (!clientObjectKey && !fileName) return bad('Missing objectKey or fileName');
          const key = clientObjectKey || fileName;
          // Force response content-type to video/mp4 to fix legacy objects with wrong MIME
          const presignedUrl = await createPresignedUrl(endpoint, key, accessKeyId, secretAccessKey, 'GET', {
            'response-content-type': fileType || 'video/mp4',
            'response-content-disposition': 'inline'
          });
          return json({
            presignedUrl: presignedUrl,
            readUrl: presignedUrl,
            url: presignedUrl,
            objectKey: key,
            expiresIn: 3600
          });
        }
      case 'set-content-type':
        {
          if (!clientObjectKey) return bad('Missing objectKey');
          if (!fileType) return bad('Missing fileType/contentType');
          // Copy object to itself with new content-type metadata
          const copySource = `${bucketName}/${clientObjectKey}`;
          const copyUrl = await createPresignedUrl(endpoint, clientObjectKey, accessKeyId, secretAccessKey, 'PUT', {
            'x-amz-copy-source': copySource,
            'x-amz-metadata-directive': 'REPLACE'
          });
          const headers = {
            'x-amz-copy-source': copySource,
            'x-amz-metadata-directive': 'REPLACE',
            'Content-Type': fileType
          };
          const res = await fetch(copyUrl, {
            method: 'PUT',
            headers
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Failed to update content-type: ${res.status} ${res.statusText} - ${errorText}`);
          }
          return json({
            success: true,
            objectKey: clientObjectKey,
            contentType: fileType,
            message: 'Content-Type updated successfully'
          });
        }
      default:
        return bad('Invalid action');
    }
  } catch (error) {
    console.error('Edge function error', {
      message: error.message,
      stack: error.stack
    });
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
function bad(msg) {
  return new Response(msg, {
    status: 400,
    headers: corsHeaders
  });
}
/* --------- Helper functions for signing --------- */ async function createPresignedUrl(endpoint, objectKey, accessKeyId, secretAccessKey, method, queryParams = {}) {
  const region = 'auto';
  const service = 's3';
  const algorithm = 'AWS4-HMAC-SHA256';
  const expires = 3600;
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const host = endpoint.replace(/^https?:\/\//, '');
  const canonicalUri = objectKey ? `/${encodePath(objectKey)}` : '/';
  // Keep empty string values so uploads= appears with the equals sign
  const pairs = [
    [
      'X-Amz-Algorithm',
      algorithm
    ],
    [
      'X-Amz-Credential',
      `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`
    ],
    [
      'X-Amz-Date',
      amzDate
    ],
    [
      'X-Amz-Expires',
      String(expires)
    ],
    [
      'X-Amz-SignedHeaders',
      'host'
    ]
  ];
  for (const [k, v] of Object.entries(queryParams)){
    pairs.push([
      k,
      v
    ]);
  }
  const encoded = pairs.map(([k, v])=>[
      encRfc3986(k),
      v === null ? null : encRfc3986(v)
    ]);
  encoded.sort((a, b)=>{
    if (a[0] === b[0]) {
      if (a[1] === b[1]) return 0;
      if (a[1] === null) return -1;
      if (b[1] === null) return 1;
      return a[1] < b[1] ? -1 : 1;
    }
    return a[0] < b[0] ? -1 : 1;
  });
  const canonicalQuery = encoded.map(([k, v])=>v === null ? k : `${k}=${v}`).join('&');
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join('\n');
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);
  const url = `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  if (DEBUG) {
    const afterQ = url.split('?')[1] || '';
    console.log('SIGV4 DEBUG', {
      method,
      host,
      canonicalUri,
      canonicalQuery,
      hasUploadsKeyOnly: /\buploads(&|$)/.test(afterQ),
      containsUploadsEquals: /\buploads=(&|$)/.test(afterQ),
      canonicalRequestHash: await sha256Hex(canonicalRequest),
      stringToSignHash: await sha256Hex(stringToSign),
      scope: credentialScope,
      amzDate,
      urlPreview: url.slice(0, 160) + (url.length > 160 ? '…' : '')
    });
  }
  return url;
}
function toAmzDate(d) {
  const pad = (n)=>n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function encRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c)=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
function encodePath(path) {
  return path.split('/').map(encodePathSegment).join('/');
}
function encodePathSegment(seg) {
  return encRfc3986(seg);
}
async function sha256Hex(message) {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
async function hmac(keyBytes, msg) {
  const enc = new TextEncoder();
  const keyData = typeof keyBytes === 'string' ? enc.encode(keyBytes) : keyBytes;
  const k = await crypto.subtle.importKey('raw', keyData, {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return new Uint8Array(sig);
}
async function hmacHex(keyBytes, msg) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', keyBytes, {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, [
    'sign'
  ]);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
async function getSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = await hmac('AWS4' + secretKey, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, 'aws4_request');
}
