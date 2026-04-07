-- Clean up duplicate (room_id, event_id) rows that were written before the
-- unique constraint existed (caused by the _getOrLoad race condition).
-- For each duplicate group, keep the row with the highest bigserial id
-- (the most recently written copy) and delete the rest.
DELETE FROM room_events
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY room_id, event_id
             ORDER BY id DESC
           ) AS rn
    FROM room_events
    WHERE event_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Now that duplicates are gone, create the unique partial index.
-- NULL event_ids are excluded — they are legacy rows that pre-date the column.
-- The event-persister now uses ON CONFLICT DO NOTHING so future duplicate
-- inserts are silently dropped rather than erroring.
CREATE UNIQUE INDEX IF NOT EXISTS room_events_room_id_event_id_key
  ON room_events (room_id, event_id)
  WHERE event_id IS NOT NULL;
