import { supabase } from '@/integrations/supabase/client';

export async function presignGetUrl(objectKey: string, mimeType = 'video/mp4', expires = 3600) {
  console.debug('[presignGetUrl] requesting', { objectKey, mimeType, expires });
  const { data, error } = await supabase.functions.invoke('r2-presign', {
    body: { action: 'presign-get', objectKey, fileType: mimeType, expires },
  });
  if (error) {
    console.error('[presignGetUrl] Edge Function error', error);
    throw error;
  }
  const url = data?.url || data?.presignedUrl;
  if (!url) {
    console.error('[presignGetUrl] No presignedUrl/url in response', data);
    throw new Error('No presignedUrl in response');
  }
  console.debug('[presignGetUrl] ok');
  return url as string;
}
