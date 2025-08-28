// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
/**
 * =========
 *  CONFIG
 * =========
 */ const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
const DEBUG_SIGV4 = (Deno.env.get("DEBUG_SIGV4") || "false").toLowerCase() === "true";
const REGION = "auto"; // Cloudflare R2 requires 'auto'
const SERVICE = "s3"; // Service for SigV4
// Virtual-hosted–style endpoint (recommended by R2):
//   https://{bucket}.{accountId}.r2.cloudflarestorage.com
const R2_HOST = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
/**
 * ========
 *  CORS
 * ========
 */ const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin"
};
/**
 * ============
 *  UTILITIES
 * ============
 */ const enc = new TextEncoder();
function toAmzDates(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const MM = String(d.getUTCMinutes()).padStart(2, "0");
  const SS = String(d.getUTCSeconds()).padStart(2, "0");
  const dateStamp = `${yyyy}${mm}${dd}`;
  const amzDate = `${dateStamp}T${HH}${MM}${SS}Z`;
  return {
    dateStamp,
    amzDate
  };
}
async function sha256Hex(data) {
  const bytes = typeof data === "string" ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [
    ...new Uint8Array(hash)
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
async function hmac(key, data, raw = false) {
  const k = key instanceof CryptoKey ? key : await crypto.subtle.importKey("raw", key, {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  return raw ? sig : [
    ...new Uint8Array(sig)
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
async function getSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = await hmac(enc.encode("AWS4" + secretKey), dateStamp, true);
  const kRegion = await hmac(kDate, region, true);
  const kService = await hmac(kRegion, service, true);
  const kSigning = await hmac(kService, "aws4_request", true);
  return kSigning;
}
function canonicalQueryStringFromObject(obj) {
  const pairs = [];
  for (const [k, v] of Object.entries(obj)){
    if (v === undefined) continue;
    const key = encodeURIComponent(k);
    const val = encodeURIComponent(String(v));
    pairs.push(`${key}=${val}`);
  }
  pairs.sort();
  return pairs.join("&");
}
function objectKeyFromName(name) {
  const safe = name.replace(/[^\w.\-+]/g, "_");
  return `${Date.now()}-${safe}`;
}
function log(...args) {
  // Always log key lifecycle events; gate deep SigV4 dumps behind DEBUG flag
  console.log(...args);
}
/**
 * ============================================
 *  SIGV4: HEADER-SIGNED (Authorization header)
 * ============================================
 */ async function signHeadersRequest(opts) {
  const method = opts.method.toUpperCase();
  const host = opts.host;
  const canonicalUri = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const canonicalQuery = canonicalQueryStringFromObject(opts.query ?? {});
  const headers = {};
  headers["host"] = host;
  for (const [k, v] of Object.entries(opts.headers ?? {})){
    headers[k.toLowerCase()] = v;
  }
  const { dateStamp, amzDate } = toAmzDates();
  const bodyBytes = typeof opts.body === "string" ? enc.encode(opts.body) : opts.body instanceof Uint8Array ? opts.body : enc.encode(""); // empty
  const payloadHash = await sha256Hex(bodyBytes);
  headers["x-amz-date"] = amzDate;
  headers["x-amz-content-sha256"] = payloadHash;
  const headersEntries = Object.entries(headers).sort(([a], [b])=>a < b ? -1 : a > b ? 1 : 0);
  const canonicalHeaders = headersEntries.map(([k, v])=>`${k}:${v.trim()}\n`).join("");
  const signedHeaderNames = headersEntries.map(([k])=>k).join(";");
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaderNames}\n${payloadHash}`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${REGION}/${SERVICE}/aws4_request\n${canonicalRequestHash}`;
  const signingKey = await getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, REGION, SERVICE);
  const signature = await hmac(signingKey, stringToSign);
  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${dateStamp}/${REGION}/${SERVICE}/aws4_request, ` + `SignedHeaders=${signedHeaderNames}, Signature=${signature}`;
  const finalHeaders = new Headers();
  for (const [k, v] of Object.entries(headers))finalHeaders.set(k, v);
  finalHeaders.set("authorization", authorization);
  if (DEBUG_SIGV4) {
    log("SIGV4 DEBUG", {
      method,
      host,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaderNames,
      payloadHash,
      canonicalRequestHash,
      stringToSignHash: await sha256Hex(stringToSign),
      scope: `${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
      amzDate,
      urlPreview: `https://${host}${canonicalUri}` + (canonicalQuery ? `?${canonicalQuery}` : "")
    });
  }
  return {
    headers: finalHeaders
  };
}
/**
 * =================================================
 *  SIGV4: QUERY PRESIGN (for client PUT part/simple)
 * =================================================
 */ async function presignUrl(opts) {
  const method = opts.method.toUpperCase();
  const host = opts.host;
  const canonicalUri = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const { dateStamp, amzDate } = toAmzDates();
  const expires = opts.expires ?? 3600;
  const q = {
    ...opts.query ?? {},
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${R2_ACCESS_KEY_ID}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expires,
    "X-Amz-SignedHeaders": (opts.signedHeaders && opts.signedHeaders.length ? opts.signedHeaders : [
      "host"
    ]).join(";")
  };
  if (opts.unsignedPayload !== false) {
    q["X-Amz-Content-Sha256"] = "UNSIGNED-PAYLOAD";
  }
  const canonicalQuery = canonicalQueryStringFromObject(q);
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaderNames = "host";
  const payloadHash = opts.unsignedPayload === false ? await sha256Hex("") : "UNSIGNED-PAYLOAD";
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaderNames}\n${payloadHash}`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${REGION}/${SERVICE}/aws4_request\n${canonicalRequestHash}`;
  const signingKey = await getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, REGION, SERVICE);
  const signature = await hmac(signingKey, stringToSign);
  const finalQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  const url = `https://${host}${canonicalUri}?${finalQuery}`;
  if (DEBUG_SIGV4) {
    log("PRESIGN DEBUG", {
      method,
      host,
      canonicalUri,
      canonicalQuery,
      payloadHash,
      canonicalRequestHash,
      stringToSignHash: await sha256Hex(stringToSign),
      urlPreview: url.slice(0, 300) + (url.length > 300 ? "…" : "")
    });
  }
  return url;
}
/**
 * ==========================
 *  R2 API HELPERS (server)
 * ==========================
 */ async function initiateMultipart(objectKey, contentType) {
  log("Initiating multipart upload...");
  const path = `/${objectKey}`;
  const query = {
    uploads: ""
  };
  // Include Content-Type so the final object gets correct type
  const { headers } = await signHeadersRequest({
    method: "POST",
    host: R2_HOST,
    path,
    query,
    headers: {
      "content-type": contentType
    },
    body: ""
  });
  // Actual request must be `?uploads` (no '=')
  const url = new URL(`https://${R2_HOST}${path}`);
  url.search = "uploads";
  const res = await fetch(url.toString(), {
    method: "POST",
    headers
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Multipart initiate failed", {
      status: res.status,
      statusText: res.statusText,
      errorBody: text,
      urlPreview: url.toString().slice(0, 300) + "…"
    });
    throw new Error(`Failed to initiate multipart upload: ${res.status} ${res.statusText} - ${text}`);
  }
  const uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(text)?.[1];
  if (!uploadId) {
    console.error("Could not parse UploadId from response", text);
    throw new Error("Could not parse UploadId from R2");
  }
  return {
    uploadId
  };
}
async function completeMultipart(objectKey, uploadId, parts) {
  const xml = `<CompleteMultipartUpload>` + parts.sort((a, b)=>a.PartNumber - b.PartNumber).map((p)=>{
    const etag = /^".*"$/.test(p.ETag) ? p.ETag : `"${p.ETag.replace(/"/g, "")}"`;
    return `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${etag}</ETag></Part>`;
  }).join("") + `</CompleteMultipartUpload>`;
  const path = `/${objectKey}`;
  const query = {
    uploadId
  };
  const { headers } = await signHeadersRequest({
    method: "POST",
    host: R2_HOST,
    path,
    query,
    headers: {
      "content-type": "application/xml"
    },
    body: xml
  });
  const url = new URL(`https://${R2_HOST}${path}`);
  url.searchParams.set("uploadId", uploadId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: xml
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Multipart complete failed", {
      status: res.status,
      statusText: res.statusText,
      errorBody: text
    });
    throw new Error(`Failed to complete multipart upload: ${res.status} ${res.statusText} - ${text}`);
  }
  return {
    ok: true,
    raw: text
  };
}
async function abortMultipart(objectKey, uploadId) {
  // IMPORTANT: do NOT include stray params that aren’t present in the URL,
  // otherwise the signature won’t match. Only sign + send `uploadId`.
  const path = `/${objectKey}`;
  const query = {
    uploadId
  };
  const { headers } = await signHeadersRequest({
    method: "DELETE",
    host: R2_HOST,
    path,
    query,
    body: ""
  });
  const url = new URL(`https://${R2_HOST}${path}`);
  url.searchParams.set("uploadId", uploadId);
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Abort multipart failed", {
      status: res.status,
      statusText: res.statusText,
      errorBody: text
    });
    throw new Error(`Failed to abort multipart upload: ${res.status} ${res.statusText}`);
  }
  return {
    ok: true
  };
}
/**
 * ==========================
 *  HTTP HANDLER
 * ==========================
 */ serve(async (req)=>{
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  let body = {};
  try {
    body = await req.json();
  } catch  {
    body = {};
  }
  try {
    const { action } = body;
    log("r2-presign request", body);
    log("R2 config fingerprint", {
      accountId: R2_ACCOUNT_ID?.slice(0, 4) + "…" + R2_ACCOUNT_ID?.slice(-4),
      accessKeyId: R2_ACCESS_KEY_ID?.slice(0, 4) + "…" + R2_ACCESS_KEY_ID?.slice(-4),
      bucket: R2_BUCKET_NAME,
      DEBUG_SIGV4
    });
    if (!action) {
      return new Response(JSON.stringify({
        error: "Missing action"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "content-type": "application/json"
        }
      });
    }
    /**
     * SIMPLE PUT (files < 5MB)
     * Returns: { presignedUrl, objectKey, publicUrl, signedGetUrl }
     */ if (action === "simple-upload") {
      const fileName = body.fileName;
      const fileType = body.fileType || "application/octet-stream";
      const expires = Number(body.expires ?? 3600);
      let objectKey = body.objectKey;
      if (!objectKey) objectKey = objectKeyFromName(fileName);
      const presignedUrl = await presignUrl({
        method: "PUT",
        host: R2_HOST,
        path: `/${objectKey}`,
        query: {
          "x-id": "PutObject"
        },
        signedHeaders: [
          "host"
        ]
      });
      // Also give the client a GET URL for immediate playback
      const signedGetUrl = await presignUrl({
        method: "GET",
        host: R2_HOST,
        path: `/${objectKey}`,
        query: {
          "response-content-type": fileType,
          "response-content-disposition": "inline"
        },
        signedHeaders: [
          "host"
        ],
        unsignedPayload: true,
        expires
      });
      const publicUrl = `https://${R2_HOST}/${objectKey}`;
      log("SIMPLE UPLOAD presigned", {
        objectKey,
        putPreview: presignedUrl.slice(0, 140) + (presignedUrl.length > 140 ? "…" : ""),
        getPreview: signedGetUrl.slice(0, 140) + (signedGetUrl.length > 140 ? "…" : "")
      });
      return new Response(JSON.stringify({
        presignedUrl,
        objectKey,
        publicUrl,
        signedGetUrl
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/json"
        }
      });
    }
    /**
     * INIT MULTIPART
     * Returns: { uploadId, objectKey, publicUrl }
     */ if (action === "initiate-multipart") {
      const fileName = body.fileName;
      const fileType = body.fileType || "application/octet-stream";
      let objectKey = body.objectKey;
      if (!objectKey) objectKey = objectKeyFromName(fileName);
      const { uploadId } = await initiateMultipart(objectKey, fileType);
      const publicUrl = `https://${R2_HOST}/${objectKey}`;
      log("Multipart upload initiated", {
        uploadId,
        objectKey
      });
      return new Response(JSON.stringify({
        uploadId,
        objectKey,
        publicUrl
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/json"
        }
      });
    }
    /**
     * PART URL
     * Returns: { presignedUrl }
     */ if (action === "get-part-url") {
      const objectKey = body.objectKey;
      const uploadId = body.uploadId;
      const partNumber = Number(body.partNumber);
      if (!objectKey || !uploadId || !partNumber) {
        return new Response(JSON.stringify({
          error: "Missing objectKey, uploadId, or partNumber"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "content-type": "application/json"
          }
        });
      }
      const presignedUrl = await presignUrl({
        method: "PUT",
        host: R2_HOST,
        path: `/${objectKey}`,
        query: {
          partNumber,
          uploadId
        },
        signedHeaders: [
          "host"
        ],
        unsignedPayload: true
      });
      if (DEBUG_SIGV4) log("PART URL presigned", {
        objectKey,
        partNumber
      });
      return new Response(JSON.stringify({
        presignedUrl
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/json"
        }
      });
    }
    /**
     * COMPLETE MULTIPART
     * Returns: { ok: true, objectKey, publicUrl, signedGetUrl }
     */ if (action === "complete-multipart") {
      const objectKey = body.objectKey;
      const uploadId = body.uploadId;
      const parts = body.parts;
      const fileType = body.fileType || "video/mp4";
      const expires = Number(body.expires ?? 3600);
      if (!objectKey || !uploadId || !Array.isArray(parts) || parts.length === 0) {
        return new Response(JSON.stringify({
          error: "Missing objectKey, uploadId, or parts"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "content-type": "application/json"
          }
        });
      }
      const result = await completeMultipart(objectKey, uploadId, parts);
      const publicUrl = `https://${R2_HOST}/${objectKey}`;
      // Hand back a fresh presigned GET to avoid a second round-trip from the client
      const signedGetUrl = await presignUrl({
        method: "GET",
        host: R2_HOST,
        path: `/${objectKey}`,
        query: {
          "response-content-type": fileType,
          "response-content-disposition": "inline"
        },
        signedHeaders: [
          "host"
        ],
        unsignedPayload: true,
        expires
      });
      log("Multipart completed", {
        objectKey,
        uploadId
      });
      return new Response(JSON.stringify({
        ...result,
        objectKey,
        publicUrl,
        signedGetUrl
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/json"
        }
      });
    }
    /**
     * ABORT MULTIPART
     */ if (action === "abort-multipart") {
      const objectKey = body.objectKey;
      const uploadId = body.uploadId;
      if (!objectKey || !uploadId) {
        return new Response(JSON.stringify({
          error: "Missing objectKey or uploadId"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "content-type": "application/json"
          }
        });
      }
      const result = await abortMultipart(objectKey, uploadId);
      log("Multipart aborted", {
        objectKey,
        uploadId
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/json"
        }
      });
    }
    /**
     * PRESIGN GET for playback
     * Returns: { url, presignedUrl }
     * Accept both "presign-get" and legacy "get-object"
     */ if (action === "presign-get" || action === "get-object") {
      const objectKey = body.objectKey;
      const fileType = body.fileType || "video/mp4";
      const expires = Number(body.expires ?? 3600);
      if (!objectKey) {
        return new Response(JSON.stringify({
          error: "Missing objectKey"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "content-type": "application/json"
          }
        });
      }
      const url = await presignUrl({
        method: "GET",
        host: R2_HOST,
        path: `/${objectKey}`,
        query: {
          "response-content-type": fileType,
          "response-content-disposition": "inline"
        },
        signedHeaders: [
          "host"
        ],
        unsignedPayload: true,
        expires
      });
      log("PRESIGN GET created", {
        objectKey,
        urlPreview: url.slice(0, 200) + (url.length > 200 ? "…" : "")
      });
      // include both keys for compatibility with different clients
      return new Response(JSON.stringify({
        url,
        presignedUrl: url
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      error: `Unknown action: ${action}`
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "content-type": "application/json"
      }
    });
  } catch (err) {
    console.error("Edge function error", {
      message: err?.message,
      stack: err?.stack
    });
    return new Response(JSON.stringify({
      error: err?.message || "Internal error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "content-type": "application/json"
      }
    });
  }
});
