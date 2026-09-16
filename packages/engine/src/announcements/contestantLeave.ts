import type { RoomEventBus } from '../events/index.js';
import { RING_PATRON } from '../constants/lore.js';

export function announceContestantLeave(
	eb: RoomEventBus,
	className: string,
	ring: any,
	{ contestant }: { contestant: any },
): void {
	const { character, monster, isBoss } = contestant;

	// "Was summoned FROM the ring" described the opposite of what happened — you summon
	// something *in*. The command is `call <monster> out of the ring`
	// (CALL_MONSTER_OUT_OF_THE_RING_REGEX), and arrivals now read "answers the call of",
	// so "called back" keeps one verb for both halves of the pair: a beastmaster calls a
	// companion in, and calls it back out.
	//
	// "Dismissed" was considered and rejected: `dismiss` is an existing command that is
	// permanent and legal only on dead monsters, so reusing it here would make a
	// reversible move read as a roster deletion.
	//
	// Bosses take the house's voice for the same reason arrivals do — their owner is
	// randomly generated, so naming it invents a beastmaster (10b-bugs-fixed.md #102).
	// "The gates" echoes The Gauntlet's banner, where they groan open to let bosses in.
	const departure = isBoss
		? `${monster.givenName} is recalled to the gates by ${RING_PATRON}.`
		: `${monster.givenName} is called back from the ring by ${character.identity}.`;

	eb.publish({
		type: 'ring.remove',
		scope: 'public',
		text: departure,
		payload: { contestant },
	});
}
