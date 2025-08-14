-- Fix foreign key constraints on gift_cards table to allow user deletion
-- The current constraints prevent user deletion when they have associated gift cards

-- Drop existing foreign key constraints that don't handle deletion properly
ALTER TABLE public.gift_cards DROP CONSTRAINT gift_cards_redeemed_by_fkey;
ALTER TABLE public.gift_cards DROP CONSTRAINT gift_cards_submitted_by_fkey;
ALTER TABLE public.gift_cards DROP CONSTRAINT gift_cards_approved_by_fkey;

-- Recreate constraints with SET NULL on delete to preserve gift card history
-- but allow user deletion
ALTER TABLE public.gift_cards 
ADD CONSTRAINT gift_cards_redeemed_by_fkey 
FOREIGN KEY (redeemed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.gift_cards 
ADD CONSTRAINT gift_cards_submitted_by_fkey 
FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.gift_cards 
ADD CONSTRAINT gift_cards_approved_by_fkey 
FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;