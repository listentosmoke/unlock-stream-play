-- Remove stripe_session_id column since no Stripe payment implementation exists
ALTER TABLE public.transactions DROP COLUMN IF EXISTS stripe_session_id;