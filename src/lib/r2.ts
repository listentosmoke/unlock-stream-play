import { supabase } from '@/integrations/supabase/client';

async function r2Presign(payload: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke('r2-presign', {
    body: payload
  });
  
  if (error) {
    throw new Error(`r2-presign ${payload.action} failed: ${error.message}`);
  }
  
  return data;
}

export async function getReadUrl(objectKey: string, expires = 3600) {
  // Edge function forces response-content-type to correct MIME
  const resp = await r2Presign({ action: "get-object", objectKey, expires });
  const url = resp.presignedUrl ?? resp.readUrl ?? resp.url;
  if (!url) {
    console.warn("Presign response payload", resp);
    throw new Error("No presigned URL in response");
  }
  return { ...resp, readUrl: url };
}

// Optional: permanently repair legacy objects (use sparingly, or via admin tool)
export async function setContentType(objectKey: string, contentType: string) {
  return r2Presign({ action: "set-content-type", objectKey, contentType });
}