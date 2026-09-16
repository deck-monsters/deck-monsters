import { and, eq, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { roomEvents } from './schema.js';

/**
 * Which `room_events` rows a given viewer may see: everything public, plus the private
 * events addressed to them.
 *
 * Shared rather than repeated. This predicate lived in `_fetchRingFeedPage` alone until
 * `loadFightEventsForSummary` was found returning *every* player's private fight
 * narration to anyone who expanded a fight in the fight log (10b-bugs-fixed.md #109).
 * Room membership is checked separately and is not enough on its own — a member is still
 * not entitled to another member's private events.
 *
 * Any new query over `room_events` on behalf of a viewer belongs on this helper. A comment
 * asking two copies not to drift is weaker than having one copy.
 */
export function eventVisibilityFor(viewerUserId: string): SQL | undefined {
	return or(
		eq(roomEvents.scope, 'public'),
		and(eq(roomEvents.scope, 'private'), eq(roomEvents.targetUserId, viewerUserId))
	);
}
