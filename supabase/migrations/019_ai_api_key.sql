-- Store coach's own API key (encrypted at app level before storage)
ALTER TABLE ai_coach_briefs ADD COLUMN api_key TEXT;
