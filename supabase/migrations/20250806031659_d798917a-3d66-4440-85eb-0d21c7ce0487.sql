-- Allow admins to insert transactions for any user
CREATE POLICY "Admins can insert transactions for any user" 
ON transactions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Allow admins to view all transactions 
CREATE POLICY "Admins can view all transactions" 
ON transactions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Allow admins to update profiles (for points)
CREATE POLICY "Admins can update any profile" 
ON profiles 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles admin_profile
  WHERE admin_profile.user_id = auth.uid() 
  AND admin_profile.role = 'admin'
));