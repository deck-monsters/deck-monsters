import type { RoomEventBus } from '../events/index.js';

interface EffectOpts {
	player: any;
	target: any;
	effectResult: string;
	narration?: string;
}

export function announceEffect(
	eb: RoomEventBus,
	className: string,
	card: any,
	{ player, target, effectResult, narration }: EffectOpts,
): void {
	eb.publish({
		type: 'announce',
		scope: 'public',
		text: `${target.icon} ${target.givenName} is currently ${effectResult} ${player.icon} ${player.givenName}.${narration ? ` ${narration}` : ''}\n`,
		payload: {},
	});
}
