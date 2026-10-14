/**
 * When a monster falls, a lasting effect it holds on another monster ends at once, and the feed
 * says so (owner, 2026-10-12/13). A hold's grip goes slack, a spell breaks, a dragon's gaze is
 * gone: the effect lived on its caster. Before this, the release waited for the victim's next
 * turn, which a hold then narrated as pushing off "the limp dead body" even for a mind hold,
 * and an awe dropped with no line at all.
 *
 * If the *victim* falls first, its effects end with it and nothing is said (roadmap 51).
 *
 * Effects that outlive their caster on purpose do not use this: a burn keeps burning (fire does
 * not care who lit it), a poisoned bottle stays poisoned, a curse already landed stays, and
 * Delayed Hit is built to strike after its owner falls ("with his dying breath").
 *
 * `release` removes the effect and tidies its state; it runs only if the effect is still on the
 * holder. The listener unhooks on the caster's fall, on `stop()`, or when the caster's fight
 * ends (a draw or a cancellation emits no death). Callers must call `stop()` on every other
 * path that ends the effect (a captive breaking free, a save, a flee): a hold-heavy monster
 * otherwise collects a listener per catch until the fight ends (PR #433 review).
 */
export function releaseWhenCasterFalls({
	caster,
	holder,
	effect,
	release,
	narrate,
	line,
	icon,
}: {
	caster: any;
	holder: any;
	effect: unknown;
	release: () => void;
	narrate: (narration: string) => void;
	/** The rest of the sentence after "<caster> has fallen, and ". */
	line: string;
	/** The card's icon, so the line says which effect ended (⏳, ➰, 🪖…). */
	icon?: string;
}): { stop: () => void } {
	const stop = (): void => {
		caster.off('die', onFalls);
		caster.off('encounterEnd', onFightEnds);
		holder.off?.('die', onHolderFalls);
	};
	const onFalls = caster.on('die', () => {
		stop();
		// A fallen victim's effects go with it: nothing to release, nothing to say.
		if (holder.dead || !holder.encounterEffects?.includes(effect)) return;
		release();
		narrate(casterFallenLine(caster, line, icon));
	});
	const onFightEnds = caster.on('encounterEnd', stop);
	// The victim falls first (owner, 2026-10-14: effects on a fallen monster end with it): stop
	// listening, or the caster's later fall would announce "<victim> is no longer coiled".
	const onHolderFalls = holder.on?.('die', stop);
	return { stop };
}

/** "<caster> has fallen, and <rest>" — the one wording for every effect a fall ends. */
export const casterFallenLine = (caster: any, rest: string, icon?: string): string =>
	`${icon ? `${icon} ` : ''}${caster.givenName} has fallen, and ${rest}`;
