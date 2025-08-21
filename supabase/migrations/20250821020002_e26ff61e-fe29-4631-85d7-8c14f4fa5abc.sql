-- Allow unauthenticated users to view approved video metadata (for marketing/preview purposes)
CREATE POLICY "Anonymous users can view approved video previews" 
ON public.videos 
FOR SELECT 
USING (
  status = 'approved'::video_status 
  AND auth.uid() IS NULL
);

-- Also update the existing policy to be more specific
DROP POLICY IF EXISTS "Public can view approved video metadata" ON public.videos;

CREATE POLICY "Authenticated users can view approved video metadata" 
ON public.videos 
FOR SELECT 
USING (
  status = 'approved'::video_status 
  AND auth.uid() IS NOT NULL
);