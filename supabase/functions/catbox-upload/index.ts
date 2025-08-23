import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    console.log("Received upload request - streaming mode");
    
    // Get content type to ensure we have multipart data
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "multipart/form-data required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
    
    console.log("Streaming directly to Catbox...");
    
    // Stream the request body directly to Catbox without parsing
    // This avoids loading the entire file into memory
    const catRes = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: req.body,
      headers: {
        "Content-Type": contentType,
      },
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

    console.log(`Upload successful: ${text}`);
    return new Response(JSON.stringify({ url: text }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (e) {
    console.error("Upload error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
});