-- Migration: Add streak_freezes_available column to user_streaks table
-- This allows users to preserve their streak when they miss a day

-- Add streak_freezes_available column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_streaks' AND column_name = 'streak_freezes_available'
    ) THEN
        ALTER TABLE user_streaks ADD COLUMN streak_freezes_available INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add streak_started_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_streaks' AND column_name = 'streak_started_at'
    ) THEN
        ALTER TABLE user_streaks ADD COLUMN streak_started_at DATE;
    END IF;
END $$;

-- Update comment
COMMENT ON COLUMN user_streaks.streak_freezes_available IS 'Number of streak freezes available (max 3)';
