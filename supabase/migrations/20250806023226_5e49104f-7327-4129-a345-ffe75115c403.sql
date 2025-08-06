-- Create gift card types enum
CREATE TYPE public.gift_card_type AS ENUM ('amazon', 'google_play', 'apple', 'steam', 'visa', 'paypal');

-- Create gift cards table for redeeming codes
CREATE TABLE public.gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  gift_card_type gift_card_type NOT NULL,
  points_value INTEGER NOT NULL,
  redeemed_by UUID REFERENCES auth.users(id),
  redeemed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID REFERENCES auth.users(id) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on gift cards
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Allow users to submit and view their own gift cards
CREATE POLICY "Users can submit gift cards" ON public.gift_cards
  FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users can view their own gift cards" ON public.gift_cards
  FOR SELECT
  USING (auth.uid() = submitted_by OR auth.uid() = redeemed_by);

-- Allow admins to view and update all gift cards (will need admin role check)
CREATE POLICY "Admins can view all gift cards" ON public.gift_cards
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can update gift cards" ON public.gift_cards
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Add trigger for updating timestamps
CREATE TRIGGER update_gift_cards_updated_at
  BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();