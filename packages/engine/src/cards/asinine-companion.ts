import { BoostCard } from './boost.js';
import { DRAGON } from '../constants/creature-types.js';
import { flavor } from '../helpers/flavor.js';

/*
 * Asinine: of donkeys (Latin asinus), as feline is of cats; the pun is the point. A dragon's
 * companion is a donkey who carries the gold and never stops talking, a nod the owner chose
 * (2026-09-29) with nothing borrowed from any film: no names, lines, or designs. A beast of
 * burden, so it lends strength. Text written by the orchestrator (roadmap 35 task 8), carrying
 * the pack's joke about what a dragon eats that it shouldn't.
 */

export class AsinineCompanionCard extends BoostCard {
	static cardType = 'Asinine Companion';
	static permittedClassesAndTypes = [DRAGON];
	static description =
		'Every hero needs a faithful companion, and every dragon needs someone to carry the gold. The donkey talks the whole way. The dragon has not eaten him. Yet.';
	static level = 1;
	static defaults = {
		...BoostCard.defaults,
		boostAmount: 2,
		boostedProp: 'str',
	};

	constructor({ icon = '🫏', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}

	override getBoostNarrative(_player: any, target: any): string {
		const { text } = flavor.getFlavor('str' as any, {
			str: [
				['loads the gold onto the donkey and stands a little taller', 60],
				['lets the donkey carry the heavy things, which is everything', 40],
				['listens to the donkey\'s advice, ignores it, and feels stronger anyway', 30],
				['stops the donkey from eating the battle standard, and is proud of the restraint', 10],
			],
		} as any);
		return `${target.givenName} ${text}.`;
	}
}

export default AsinineCompanionCard;
