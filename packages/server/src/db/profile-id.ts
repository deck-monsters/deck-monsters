/**
 * Guards for the `uuid` columns that reference `public.profiles`.
 *
 * Not every `userId` flowing out of the engine is a profile. Boss contestants carry the
 * sentinel `userId: 'boss'` (`helpers/bosses.ts`), which appears in `ring.fightResolved`
 * participants and as `targetUserId` on boss win/loss events. Inserting that into a `uuid`
 * column throws, so every write path has to filter it out first.
 */

/** Accept any UUID-shaped hex so non-v4 profile IDs still pass; rejects Discord snowflakes etc. */
export const UUID_HEX_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function profileUuidOrNull(value: string | null | undefined): string | null {
	if (!value || !UUID_HEX_RE.test(value)) return null;
	return value;
}

export function isProfileUuid(value: string | null | undefined): value is string {
	return profileUuidOrNull(value) !== null;
}
