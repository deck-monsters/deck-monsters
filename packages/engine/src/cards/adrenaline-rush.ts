import { EcdysisCard } from './ecdysis.js';
import { BARBARIAN, FIGHTER } from '../constants/creature-classes.js';

export class AdrenalineRushCard extends EcdysisCard {
	static cardType = 'Adrenaline Rush';
	static permittedClassesAndTypes = [BARBARIAN, FIGHTER];
	static description =
		"Life or Death brings about a certain focus... A certain AWAKENESS most people don't actually want. It's what you live for. It's how you know you exist. You embrace it and welcome the rush.";
	static defaults = {
		...EcdysisCard.defaults,
	};

	constructor({ boosts, icon = '❗️', ...rest }: Record<string, any> = {}) {
		super({ boosts, icon, ...rest });
	}
}

export default AdrenalineRushCard;
