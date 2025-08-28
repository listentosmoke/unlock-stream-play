import { supabase } from '@/integrations/supabase/client';

export async function presignGetUrl(objectKey: string, mimeType = 'video/mp4', expires = 3600) {
  const { data, error } = await supabase.functions.invoke('r2-presign', {
    body: { action: 'presign-get', objectKey, fileType: mimeType, expires },
  });
  if (error) throw error;
  // Our function returns both { url, presignedUrl }. Use either.
  const url = data?.url || data?.presignedUrl;
  if (!url) throw new Error('No presignedUrl in response');
  return url as string;
}