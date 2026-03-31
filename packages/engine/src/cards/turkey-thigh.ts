import { SurvivalKnifeCard } from './survival-knife.js';
import { BARBARIAN } from '../constants/creature-classes.js';

export class TurkeyThighCard extends SurvivalKnifeCard {
	static cardType = 'Turkey Thigh';
	static description =
		'Beat your opponent with a huge turkey thigh. If times get tough, take a bite for a quick hp boost.';
	static permittedClassesAndTypes = [BARBARIAN];

	constructor({ icon = '🍗', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}
}

export default TurkeyThighCard;
