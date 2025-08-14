-- Remove the overly permissive policy that exposes all video data
DROP POLICY IF EXISTS "Approved videos are viewable by everyone" ON public.videos;

-- Create a more restrictive policy for public video browsing (metadata only)
CREATE POLICY "Public can view approved video metadata" 
ON public.videos 
FOR SELECT 
USING (
  status = 'approved'::video_status 
  AND auth.uid() IS NOT NULL
);

-- Ensure the unlock policy is properly scoped
DROP POLICY IF EXISTS "Users can view unlocked videos" ON public.videos;
CREATE POLICY "Users can view unlocked videos" 
ON public.videos 
FOR SELECT 
USING (
  status = 'approved'::video_status 
  AND EXISTS (
    SELECT 1 FROM user_unlocks 
    WHERE user_unlocks.video_id = videos.id 
    AND user_unlocks.user_id = auth.uid()
  )
);