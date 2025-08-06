-- Make the first user admin (replace with your user_id if different)
UPDATE profiles 
SET role = 'admin' 
WHERE user_id = '4b72d557-9b32-44b6-9e72-db220fa5cc9c';

-- Update gift cards table to remove user-set points and add admin-set conversion
ALTER TABLE public.gift_cards 
DROP COLUMN points_value;

ALTER TABLE public.gift_cards 
ADD COLUMN dollar_value DECIMAL(10,2),
ADD COLUMN points_awarded INTEGER DEFAULT 0,
ADD COLUMN approved_by UUID REFERENCES auth.users(id),
ADD COLUMN approved_at TIMESTAMPTZ;