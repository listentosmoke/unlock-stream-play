import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// R2 configuration
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME');
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');

// Large file threshold (100MB)
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  try {
    console.log("Received upload request");
    
    // Parse FormData to get file information
    const form = await req.formData();
    const file = form.get("fileToUpload") as File | null;
    
    if (!file) {
      return new Response(JSON.stringify({ error: "fileToUpload is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);

    // Determine upload method based on file size
    if (file.size > LARGE_FILE_THRESHOLD) {
      console.log("Large file detected, using R2 multipart upload");
      return await uploadToR2Multipart(file);
    } else {
      console.log("Small file, using Catbox");
      return await uploadToCatbox(form);
    }
  } catch (e) {
    console.error("Upload error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
});

// Upload to Catbox for smaller files
async function uploadToCatbox(formData: FormData) {
  try {
    const catRes = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: formData,
    });

    const text = (await catRes.text()).trim();
    console.log(`Catbox response: ${catRes.status}, body: ${text}`);

    if (!catRes.ok || !text.startsWith("http")) {
      console.error(`Catbox upload failed: ${text}`);
      return new Response(JSON.stringify({ error: text || "Catbox upload failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    console.log(`Catbox upload successful: ${text}`);
    return new Response(JSON.stringify({ url: text }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (error) {
    console.error("Catbox upload error:", error);
    throw error;
  }
}

// Upload to R2 using multipart upload for large files
async function uploadToR2Multipart(file: File) {
  try {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_ACCOUNT_ID) {
      throw new Error("R2 credentials not configured");
    }

    const fileName = `videos/${crypto.randomUUID()}-${file.name}`;
    const r2Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    
    // Start multipart upload
    const uploadId = await initiateMultipartUpload(r2Endpoint, fileName);
    console.log(`Started multipart upload: ${uploadId}`);
    
    // Upload parts (5MB chunks)
    const chunkSize = 5 * 1024 * 1024; // 5MB
    const totalParts = Math.ceil(file.size / chunkSize);
    const parts = [];
    
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      console.log(`Uploading part ${partNumber}/${totalParts} (${chunk.size} bytes)`);
      
      const etag = await uploadPart(r2Endpoint, fileName, uploadId, partNumber, chunk);
      parts.push({ PartNumber: partNumber, ETag: etag });
    }
    
    // Complete multipart upload
    const finalUrl = await completeMultipartUpload(r2Endpoint, fileName, uploadId, parts);
    console.log(`R2 upload completed: ${finalUrl}`);
    
    return new Response(JSON.stringify({ url: finalUrl }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
    
  } catch (error) {
    console.error("R2 upload error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
}

// Generate AWS signature v4
async function generateSignature(stringToSign: string, dateKey: Uint8Array, regionName: string, serviceName: string) {
  const kDate = await createHmac(dateKey, stringToSign.split('\n')[1]);
  const kRegion = await createHmac(kDate, regionName);
  const kService = await createHmac(kRegion, serviceName);
  const kSigning = await createHmac(kService, 'aws4_request');
  return await createHmac(kSigning, stringToSign);
}

async function createHmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

// Create AWS v4 signed request
async function createSignedRequest(method: string, url: string, body?: Uint8Array, headers: Record<string, string> = {}) {
  const urlObj = new URL(url);
  const host = urlObj.host;
  const path = urlObj.pathname + urlObj.search;
  
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = dateStr.slice(0, 8);
  
  // Required headers
  const allHeaders = {
    'host': host,
    'x-amz-date': dateStr,
    ...headers
  };
  
  if (body) {
    const hash = await createHash("sha256").update(body).digest();
    allHeaders['x-amz-content-sha256'] = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    allHeaders['x-amz-content-sha256'] = 'UNSIGNED-PAYLOAD';
  }
  
  // Create canonical request
  const sortedHeaders = Object.keys(allHeaders).sort().map(key => `${key}:${allHeaders[key]}`).join('\n');
  const signedHeaders = Object.keys(allHeaders).sort().join(';');
  
  const canonicalRequest = [
    method,
    path,
    '', // query string
    sortedHeaders,
    '',
    signedHeaders,
    allHeaders['x-amz-content-sha256']
  ].join('\n');
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalRequestHash = await createHash("sha256").update(canonicalRequest).digest();
  const canonicalRequestHashHex = Array.from(canonicalRequestHash).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const stringToSign = [
    algorithm,
    dateStr,
    credentialScope,
    canonicalRequestHashHex
  ].join('\n');
  
  // Calculate signature
  const signingKey = await generateSignature(stringToSign, new TextEncoder().encode(`AWS4${R2_SECRET_ACCESS_KEY}`), 'auto', 's3');
  const signatureHex = Array.from(signingKey).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Add authorization header
  allHeaders['authorization'] = `${algorithm} Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
  
  return allHeaders;
}

async function initiateMultipartUpload(endpoint: string, key: string): Promise<string> {
  const url = `${endpoint}/${R2_BUCKET_NAME}/${key}?uploads`;
  const headers = await createSignedRequest('POST', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to initiate multipart upload: ${error}`);
  }
  
  const xml = await response.text();
  const uploadIdMatch = xml.match(<UploadId>([^<]+)</UploadId>);
  
  if (!uploadIdMatch) {
    throw new Error('Could not extract upload ID from response');
  }
  
  return uploadIdMatch[1];
}

async function uploadPart(endpoint: string, key: string, uploadId: string, partNumber: number, chunk: Blob): Promise<string> {
  const url = `${endpoint}/${R2_BUCKET_NAME}/${key}?partNumber=${partNumber}&uploadId=${uploadId}`;
  const body = new Uint8Array(await chunk.arrayBuffer());
  const headers = await createSignedRequest('PUT', url, body, {
    'content-type': 'application/octet-stream'
  });
  
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload part ${partNumber}: ${error}`);
  }
  
  const etag = response.headers.get('etag');
  if (!etag) {
    throw new Error(`No ETag returned for part ${partNumber}`);
  }
  
  return etag;
}

async function completeMultipartUpload(endpoint: string, key: string, uploadId: string, parts: Array<{PartNumber: number, ETag: string}>): Promise<string> {
  const url = `${endpoint}/${R2_BUCKET_NAME}/${key}?uploadId=${uploadId}`;
  
  const partsXml = parts.map(part => 
    `<Part><PartNumber>${part.PartNumber}</PartNumber><ETag>${part.ETag}</ETag></Part>`
  ).join('');
  
  const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
  const bodyBytes = new TextEncoder().encode(body);
  
  const headers = await createSignedRequest('POST', url, bodyBytes, {
    'content-type': 'application/xml'
  });
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyBytes
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to complete multipart upload: ${error}`);
  }
  
  // Return public URL
  return `${endpoint}/${R2_BUCKET_NAME}/${key}`;
}