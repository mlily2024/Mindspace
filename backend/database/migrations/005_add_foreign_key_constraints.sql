-- Migration 005: Add missing foreign key constraints
-- Non-breaking: uses DO blocks with IF NOT EXISTS checks

-- Add foreign key on voice_analyses.entry_id -> mood_entries.entry_id
-- (was missing in 002_phase1_features.sql)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_voice_analyses_entry'
        AND table_name = 'voice_analyses'
    ) THEN
        ALTER TABLE voice_analyses
        ADD CONSTRAINT fk_voice_analyses_entry
        FOREIGN KEY (entry_id) REFERENCES mood_entries(entry_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add foreign key on mood_entries.voice_analysis_id -> voice_analyses.analysis_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_mood_entries_voice_analysis'
        AND table_name = 'mood_entries'
    ) THEN
        ALTER TABLE mood_entries
        ADD CONSTRAINT fk_mood_entries_voice_analysis
        FOREIGN KEY (voice_analysis_id) REFERENCES voice_analyses(analysis_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add CHECK constraint on recommendations.priority
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'chk_recommendations_priority'
    ) THEN
        ALTER TABLE recommendations
        ADD CONSTRAINT chk_recommendations_priority CHECK (priority >= 1);
    END IF;
END $$;
