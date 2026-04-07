-- Add a unique constraint on (room_id, event_id) to prevent duplicate event
-- writes from races or retries.  NULL event_ids are excluded (they're legacy
-- rows that pre-date the event_id column).
--
-- The event-persister now uses ON CONFLICT DO NOTHING so duplicate inserts are
-- silently dropped rather than erroring.
CREATE UNIQUE INDEX IF NOT EXISTS room_events_room_id_event_id_key
  ON room_events (room_id, event_id)
  WHERE event_id IS NOT NULL;
