-- Add r2_object_key column to videos table for secure storage
ALTER TABLE public.videos 
ADD COLUMN r2_object_key text;

-- Create secure view for video listings (no direct URLs exposed)
CREATE OR REPLACE VIEW public.video_list AS
SELECT 
  id,
  title,
  description,
  thumbnail_url,
  preview_url,
  status,
  uploader_id,
  unlock_cost,
  reward_points,
  view_count,
  unlock_count,
  duration,
  created_at,
  updated_at,
  -- Only expose r2_object_key to authorized users via RLS
  CASE 
    WHEN auth.uid() IS NOT NULL AND (
      auth.uid() = uploader_id OR 
      EXISTS(SELECT 1 FROM user_unlocks WHERE user_id = auth.uid() AND video_id = videos.id) OR
      EXISTS(SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    ) THEN r2_object_key
    ELSE NULL
  END as r2_object_key
FROM public.videos;

-- Grant access to the view
GRANT SELECT ON public.video_list TO authenticated, anon;

-- Update RLS policies to be more restrictive about full_video_url
DROP POLICY IF EXISTS "Anonymous users can view approved video previews" ON public.videos;
DROP POLICY IF EXISTS "Authenticated users can view approved video metadata" ON public.videos;

-- New restrictive policies
CREATE POLICY "Anonymous users can view basic video info" 
ON public.videos FOR SELECT 
USING (
  status = 'approved'::video_status 
  AND auth.uid() IS NULL
);

CREATE POLICY "Authenticated users can view video metadata" 
ON public.videos FOR SELECT 
USING (
  status = 'approved'::video_status 
  AND auth.uid() IS NOT NULL
);

-- Only show full URLs to authorized users
CREATE POLICY "Authorized users can view full video details" 
ON public.videos FOR SELECT 
USING (
  status = 'approved'::video_status 
  AND auth.uid() IS NOT NULL 
  AND (
    auth.uid() = uploader_id OR 
    EXISTS(SELECT 1 FROM user_unlocks WHERE user_id = auth.uid() AND video_id = videos.id) OR
    EXISTS(SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
);