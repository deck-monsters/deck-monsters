import { SurvivalKnifeCard } from './survival-knife.js';
import { BARD, CLERIC } from '../constants/creature-classes.js';

export class IocaneCard extends SurvivalKnifeCard {
	static cardType = 'Iocane';
	static description =
		'They were both poisoned. I spent the last few years building up an immunity to iocane powder...';
	static permittedClassesAndTypes = [BARD, CLERIC];

	constructor({ icon = '⚗️', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}
}

export default IocaneCard;
