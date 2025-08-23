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
    
    // Parse FormData to get the file
    const form = await req.formData();
    const file = form.get("file") as File | null;
    
    if (!file) {
      return new Response(JSON.stringify({ error: "file is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);
    
    // Create proper Catbox FormData
    const catForm = new FormData();
    catForm.append("reqtype", "fileupload");
    catForm.append("fileToUpload", file, file.name);
    
    console.log("Forwarding to Catbox...");
    const catRes = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: catForm,
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