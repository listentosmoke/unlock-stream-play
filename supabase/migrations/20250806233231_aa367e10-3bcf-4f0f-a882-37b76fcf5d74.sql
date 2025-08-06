-- Add additional security constraints to prevent points manipulation

-- Add check constraint to ensure points cannot be negative
ALTER TABLE profiles ADD CONSTRAINT check_points_non_negative CHECK (points >= 0);

-- Add check constraint to ensure transaction amounts are within reasonable bounds
ALTER TABLE transactions ADD CONSTRAINT check_transaction_amount_bounds CHECK (amount >= -10000 AND amount <= 10000);

-- Add check constraint to ensure unlock costs are positive
ALTER TABLE videos ADD CONSTRAINT check_unlock_cost_positive CHECK (unlock_cost > 0);

-- Add check constraint to ensure reward points are positive
ALTER TABLE videos ADD CONSTRAINT check_reward_points_positive CHECK (reward_points >= 0);

-- Create function to validate point transactions
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
$$ LANGUAGE plpgsql;

-- Create trigger to validate transactions before insert
CREATE TRIGGER validate_transaction_trigger
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_point_transaction();

-- Create function to prevent duplicate unlocks
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
$$ LANGUAGE plpgsql;

-- Create trigger to prevent duplicate unlocks
CREATE TRIGGER prevent_duplicate_unlock_trigger
  BEFORE INSERT ON user_unlocks
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_unlock();