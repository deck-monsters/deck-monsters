-- Add quarantined_blob column to rooms table.
-- When restoreGame fails on a corrupted state_blob, the server moves the
-- bad data here (for debugging) and starts a fresh game rather than
-- making the room permanently unloadable.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS quarantined_blob text;
