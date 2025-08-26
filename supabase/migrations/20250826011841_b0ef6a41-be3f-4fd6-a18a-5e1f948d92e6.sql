-- Fix the security definer view issue by removing the view and using direct table access with proper RLS
DROP VIEW IF EXISTS public.video_list;

-- The RLS policies on the videos table are sufficient for security
-- No need for a separate view that could cause security definer issues