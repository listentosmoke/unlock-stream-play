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
    
    // Stream the request body directly to Catbox without parsing FormData
    // This avoids loading the entire file into memory
    console.log("Forwarding stream to Catbox...");
    const catRes = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: req.body,
      headers: {
        "Content-Type": req.headers.get("content-type") || "",
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