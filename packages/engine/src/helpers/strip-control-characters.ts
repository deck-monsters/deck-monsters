/**
 * Removes C0 control characters (U+0000-U+001F) and DEL (U+007F) from free text a player
 * typed as a name.
 *
 * Why: room state is stored as `jsonb`, which rejects a NUL (`\u0000`) anywhere in a string
 * or object key, and the save is fire-and-forget, so one pasted NUL in a name would silently
 * stop the whole room saving (roadmap 37). Names have no legitimate use for control
 * characters, so they are dropped where they enter the engine; `repairSerializedGame` is the
 * backstop for anything that gets past this.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

export const stripControlCharacters = (text: string): string =>
	text.replace(CONTROL_CHARACTERS, '');
