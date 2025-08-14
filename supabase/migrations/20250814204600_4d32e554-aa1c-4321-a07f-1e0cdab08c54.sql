-- Add admin_adjustment transaction type to the enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'admin_adjustment';