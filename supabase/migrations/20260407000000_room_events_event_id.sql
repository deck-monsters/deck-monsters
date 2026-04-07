-- Add event_id column to room_events so we can store the in-memory event UUID
-- alongside the DB's own bigserial PK.  This enables exact deduplication when
-- clients hydrate from DB history and then reconnect via the live subscription.
--
-- Nullable: existing rows keep event_id = NULL.  New rows written by the
-- updated event-persister will always have the UUID set.
ALTER TABLE room_events ADD COLUMN IF NOT EXISTS event_id text;
CREATE INDEX IF NOT EXISTS room_events_event_id_idx ON room_events (event_id)
  WHERE event_id IS NOT NULL;
