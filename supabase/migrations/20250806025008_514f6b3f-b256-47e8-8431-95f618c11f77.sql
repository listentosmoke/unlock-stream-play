-- Make the specific user an admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE user_id = '4b72d557-9b32-44b6-9e72-db220fa5cc9c';

-- Remove dollar_value column from gift_cards since admin will determine value
ALTER TABLE public.gift_cards DROP COLUMN IF EXISTS dollar_value;