import { CurseCard } from './curse.js';
import { HitCard } from './hit.js';
import { CLERIC } from '../constants/creature-classes.js';
import { JINN } from '../constants/creature-types.js';
import { chance } from '../helpers/chance.js';
import { PSYCHIC } from '../constants/card-classes.js';
import { REASONABLE } from '../helpers/costs.js';
import * as STATS from '../constants/stats.js';

const { max } = chance;

export class BrainDrainCard extends CurseCard {
	static cardClass = [PSYCHIC];
	static cardType = 'Brain Drain';
	static permittedClassesAndTypes = [CLERIC, JINN];
	static description = 'And we shall bury our enemies in their own confusion.';
	static cost = REASONABLE.cost;
	static defaults = {
		...CurseCard.defaults,
		curseAmount: -20,
		cursedProp: 'xp',
		targetProp: 'int',
	};

	constructor({ icon = '🤡', ...rest }: Record<string, any> = {}) {
		super({ icon, ...rest });
	}

	override get stats(): string {
		const hit = new HitCard(this.options as any);
		const maxMod = (STATS.MAX_PROP_MODIFICATIONS as any)[this.cursedProp] ?? 1;
		let stats = `Curse: ${this.cursedProp} ${this.curseAmount}\nCan reduce ${this.cursedProp} down to ${maxMod}, then takes ${max(this.damageDice)} from hp instead.`;

		if (this.hasChanceToHit) {
			stats = `${hit.stats}\n${stats}`;
		}

		return stats;
	}
}

export default BrainDrainCard;
