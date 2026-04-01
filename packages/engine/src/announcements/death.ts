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

	if (destroyed) {
		text = `In accordance with XinWey's Doctrine: A person needs to experience real danger or they will never find joy in excelling. There has to be a risk of failure, the chance to die.
As such, ${monster.identityWithHp} has been sent to the land of ${monster.pronouns.his} ancestors by ${assailant.identityWithHp}
So it is written. So it is done.
☠️  R.I.P ${monster.identity}
`;
	} else {
		text = `💀  ${monster.identityWithHp} is killed by ${assailant.identityWithHp}\n`;
	}

	eb.publish({ type: 'announce', scope: 'public', text, payload: { monster, assailant, destroyed } });
}
