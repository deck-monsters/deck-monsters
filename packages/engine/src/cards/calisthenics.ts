import { BoostCard } from './boost.js';
import { random } from '../helpers/random.js';
import { BARBARIAN, FIGHTER } from '../constants/creature-classes.js';
import { REASONABLE } from '../helpers/costs.js';

export class CalisthenicsCard extends BoostCard {
	static cardType = 'Calisthenics';
	static permittedClassesAndTypes = [BARBARIAN, FIGHTER];
	static description = 'Your daily workout routine limbers you up for battle.';
	static level = 2;
	static cost = REASONABLE.cost;
	static defaults = {
		...BoostCard.defaults,
		boostAmount: 2,
		boostedProp: 'dex',
	};

	constructor({ icon = '🙆‍', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}

	override get boostAmount(): number {
		return random(1, (this.options as any).boostAmount);
	}

	override get stats(): string {
		return `Boost: ${this.boostedProp} +1-${(this.options as any).boostAmount} depending on how deep the stretch is`;
	}
}

export default CalisthenicsCard;
