import { toCombatActor } from '../events/combat.js';
import type { CombatPayload, FeedLine } from '../events/types.js';
import type { RoomEventBus } from '../events/index.js';

export function announceHeal(
	eb: RoomEventBus,
	ring: any,
	className: string,
	monster: any,
	{ amount }: { amount: number },
): void {
	if (ring.monsterIsInRing(monster)) {
		const combat: CombatPayload = {
			kind: 'heal',
			actor: toCombatActor(monster),
			target: toCombatActor(monster),
			amount,
			hp: monster.hp,
			maxHp: monster.maxHp,
		};
		// Heal's Curse of Loki (poison) and Bad Batch heal by a negative amount, and the feed
		// said "healed -2 hp" (bug 260). A loss reads as a loss.
		const text = amount < 0
			? `${monster.icon} 🤢 ${monster.givenName} lost ${-amount} hp and has *${monster.hp} hp*.`
			: `${monster.icon} 💊 ${monster.givenName} healed ${amount} hp and has *${monster.hp} hp*.`;
		eb.publish({
			type: 'announce',
			scope: 'public',
			text,
			payload: {
				monster,
				amount,
				combat,
				lines: [
					{ kind: 'heal', text, name: monster.givenName, amount, hp: monster.hp, maxHp: monster.maxHp },
				] satisfies FeedLine[],
			},
		});
	}
}
