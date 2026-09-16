/**
 * Tracks what the feed last showed, so pacing can respond to content instead of
 * being a fixed interval.
 *
 * Measured on real fights before this existed, the pacing was *inverted*: the pause
 * following a message averaged 3.7s after a one-line result, 2.5s after 2–3 lines and
 * only 1.6s after 4+ lines — so the ten-line ASCII card box, the single thing that
 * actually needs reading time, got the shortest pause, and a one-line damage result got
 * the longest. That is because the fixed `subEventDelay` sat after every emit regardless
 * of size, and the long gaps were an artefact of card-boundary stacking (below) rather
 * than of anything to do with the content.
 *
 * `RoomEventBus.publish` reports every public message here; the delay helpers read it
 * back. Keeping it in its own module avoids a cycle (bus → pacing-context,
 * delay-times → pacing-context) and keeps `delay-times.ts` free of engine imports.
 *
 * This is process-wide rather than per-room, which is deliberate: it only ever shapes
 * how long a timer waits, never what is published or to whom, so a second room nudging
 * the numbers can at worst make one pause slightly long or short. Room-scoping it would
 * mean threading a room handle through every card and creature delay call site for no
 * behavioural gain.
 */

interface LastEmit {
	at: number;
	/** Rendered line count, which is what a reader actually scans. */
	lines: number;
	chars: number;
}

let lastEmit: LastEmit | undefined;

/** Records a message as it goes out to the feed. */
export function noteEmitted(text: string): void {
	const trimmed = text.trim();
	if (!trimmed) return;

	lastEmit = {
		at: Date.now(),
		lines: trimmed.split('\n').filter(line => line.trim().length > 0).length,
		chars: trimmed.length,
	};
}

/** Shape of the last message shown, or undefined if nothing has been emitted yet. */
export function lastEmittedShape(): { lines: number; chars: number } | undefined {
	return lastEmit ? { lines: lastEmit.lines, chars: lastEmit.chars } : undefined;
}

/**
 * How long the feed has already been idle since the last message. Used to subtract
 * elapsed time from a target gap so successive waits do not stack.
 */
export function msSinceLastEmit(): number {
	if (!lastEmit) return 0;
	return Math.max(0, Date.now() - lastEmit.at);
}

/** Test helper — clears the recorded state so cases do not leak into each other. */
export function resetPacingContext(): void {
	lastEmit = undefined;
}
