import { BoostCard } from './boost.js';
import { DRAGON } from '../constants/creature-types.js';

export class AsinineCompanionCard extends BoostCard {
	static cardType = 'Asinine Companion';
	static permittedClassesAndTypes = [DRAGON];
	static description = 'A companion boosts the strength of the caster.';
	static level = 1;
	static defaults = {
		...BoostCard.defaults,
		boostAmount: 2,
		boostedProp: 'str',
	};

	constructor({ icon = '🫏', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}
}

export default AsinineCompanionCard;
