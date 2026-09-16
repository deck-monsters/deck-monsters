/**
 * Strips an email address down to something safe to show other players.
 *
 * `handle_new_user` (see `supabase/migrations/20260403000000_fix_profile_trigger.sql`)
 * fills `profiles.display_name` with
 * `coalesce(display_name, full_name, email, '')`, so a web signup that never set a
 * display name gets their **full email address** as their in-game name. That name
 * becomes the engine character's `givenName`, which is then printed in the public
 * ring roster, fight narration and the leaderboard — broadcasting a real email to
 * everyone in the room.
 *
 * Masking here rather than at each render point means the address never reaches a
 * client at all. The local part is kept because it is usually the name the player
 * would have chosen anyway, and a plus-address suffix (`dave+levy@…`) is dropped
 * since it is routing detail, not identity.
 */
export function publicDisplayName(raw: string | null | undefined): string {
	const value = (raw ?? '').trim();
	if (!value) return 'Player';

	const at = value.lastIndexOf('@');
	// Only treat it as an email when there is a local part and the domain looks like
	// one; a name that merely contains "@" (e.g. "@stary") is left alone.
	if (at > 0 && /^[^\s@]+\.[^\s@]+$/.test(value.slice(at + 1))) {
		const local = value.slice(0, at).split('+')[0]!.trim();
		return local.length > 0 ? local : 'Player';
	}

	return value;
}
