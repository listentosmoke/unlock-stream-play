-- Fix RLS policies for admin access to videos
DROP POLICY IF EXISTS "Admins can view all videos" ON videos;
CREATE POLICY "Admins can view all videos" 
ON videos 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Fix RLS policies for admin access to gift cards (should already exist but let's verify)
DROP POLICY IF EXISTS "Admins can view all gift cards" ON gift_cards;
CREATE POLICY "Admins can view all gift cards" 
ON gift_cards 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Also allow admins to update videos for approval/rejection
DROP POLICY IF EXISTS "Admins can update videos" ON videos;
CREATE POLICY "Admins can update videos" 
ON videos 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));