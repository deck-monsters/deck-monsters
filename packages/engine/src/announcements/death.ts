import { toCombatActor } from '../events/combat.js';
import type { CombatPayload, FeedLine } from '../events/types.js';
import type { RoomEventBus } from '../events/index.js';

interface DeathOpts {
	assailant: any;
	destroyed: boolean;
}

export function announceDeath(
	eb: RoomEventBus,
	className: string,
	monster: any,
	{ assailant, destroyed }: DeathOpts,
): void {
	let text: string;
	let doctrine = '';
	let asSuch = '';
	let soItIsWritten = '';
	let epitaph = '';

	if (destroyed) {
		doctrine = `In accordance with XinWey's Doctrine: A person needs to experience real danger or they will never find joy in excelling. There has to be a risk of failure, the chance to die.`;
		asSuch = `As such, ${monster.identityWithHp} has been sent to the land of ${monster.pronouns.his} ancestors by ${assailant.identityWithHp}`;
		soItIsWritten = 'So it is written. So it is done.';
		epitaph = `☠️  R.I.P ${monster.identity}`;
		text = `${doctrine}\n${asSuch}\n${soItIsWritten}\n${epitaph}\n`;
	} else {
		text = `💀  ${monster.identityWithHp} is killed by ${assailant.identityWithHp}\n`;
	}

	const combat: CombatPayload = {
		kind: 'death',
		target: toCombatActor(monster),
		// Every caller today supplies an assailant (the text above depends on it); the
		// optional `actor` exists so a future cause-less death can reuse the DTO shape.
		...(assailant === undefined ? {} : { actor: toCombatActor(assailant) }),
		destroyed,
	};

	// Same strings as `text`, one per line. The Doctrine block is prose around the one line that
	// says who killed whom; the epitaph is a plain system line.
	const by: string | undefined = assailant?.givenName;
	const lines: FeedLine[] = destroyed
		? [
				{ kind: 'narration', text: doctrine },
				{ kind: 'death', text: asSuch, name: monster.givenName, ...(by === undefined ? {} : { by }), destroyed: true },
				{ kind: 'narration', text: soItIsWritten },
				{ kind: 'system', text: epitaph, name: monster.givenName },
			]
		: [{ kind: 'death', text: text.trim(), name: monster.givenName, ...(by === undefined ? {} : { by }), destroyed: false }];

	eb.publish({ type: 'announce', scope: 'public', text, payload: { monster, assailant, destroyed, combat, lines } });
}
