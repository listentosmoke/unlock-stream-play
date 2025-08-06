-- Fix search_path security issues for functions
CREATE OR REPLACE FUNCTION validate_point_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- For unlock transactions, ensure user has enough points
  IF NEW.type = 'unlock' AND NEW.amount < 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = NEW.user_id 
      AND points >= ABS(NEW.amount)
    ) THEN
      RAISE EXCEPTION 'Insufficient points for transaction';
    END IF;
  END IF;
  
  -- Ensure video_id exists for unlock transactions
  IF NEW.type = 'unlock' AND NEW.video_id IS NULL THEN
    RAISE EXCEPTION 'Video ID required for unlock transactions';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE OR REPLACE FUNCTION prevent_duplicate_unlock()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already unlocked this video
  IF EXISTS (
    SELECT 1 FROM user_unlocks 
    WHERE user_id = NEW.user_id 
    AND video_id = NEW.video_id
  ) THEN
    RAISE EXCEPTION 'Video already unlocked by this user';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';