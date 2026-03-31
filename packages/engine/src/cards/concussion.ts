import { CurseCard } from './curse.js';
import { random } from '../helpers/random.js';
import { BARBARIAN, FIGHTER } from '../constants/creature-classes.js';
import { MELEE } from '../constants/card-classes.js';
import { REASONABLE } from '../helpers/costs.js';

export class ConcussionCard extends CurseCard {
	static cardClass = [MELEE];
	static cardType = 'Concussion';
	static permittedClassesAndTypes = [BARBARIAN, FIGHTER];
	static description = 'A hard blow to the head should do the trick.';
	static cost = REASONABLE.cost;
	static defaults = {
		...CurseCard.defaults,
		curseAmount: -2,
		cursedProp: 'int',
	};

	constructor({ icon = '🥊', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}

	override get curseAmount(): number {
		return random(-1, (this.options as any).curseAmount);
	}

	get curseDescription(): string {
		return `Curse: ${this.cursedProp} -1${(this.options as any).curseAmount} depending on how hard the hit is`;
	}
}

export default ConcussionCard;
