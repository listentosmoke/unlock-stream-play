-- Allow admins to delete videos
CREATE POLICY "Admins can delete videos" 
ON videos 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Allow users to view videos they have unlocked
CREATE POLICY "Users can view unlocked videos" 
ON videos 
FOR SELECT 
USING (
  status = 'approved' AND (
    EXISTS (
      SELECT 1 FROM user_unlocks 
      WHERE user_unlocks.video_id = videos.id 
      AND user_unlocks.user_id = auth.uid()
    )
  )
);