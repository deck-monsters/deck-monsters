import type { RoomEventBus } from '../events/index.js';
import { leadLines } from '../events/feed-lines.js';

interface EffectOpts {
	player: any;
	target: any;
	effectResult: string;
	narration?: string;
	/** A first-time note key (apps/web/src/lib/mechanic-notes.ts). */
	mechanic?: string;
}

export function announceEffect(
	eb: RoomEventBus,
	className: string,
	card: any,
	{ player, target, effectResult, narration, mechanic }: EffectOpts,
): void {
	const text = `${target.icon} ${target.givenName} is currently ${effectResult} ${player.icon} ${player.givenName}.${narration ? ` ${narration}` : ''}\n`;

	eb.publish({
		type: 'announce',
		scope: 'public',
		text,
		payload: {
			...(mechanic ? { mechanic } : {}),
			lines: leadLines(text, line => ({
				kind: 'effect',
				text: line,
				target: target.givenName,
				source: player.givenName,
			})),
		},
	});
}
