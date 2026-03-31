import { BaseCard, type CardOptions } from './base.js';
import { BOOST } from '../constants/card-classes.js';
import { COMMON } from '../helpers/probabilities.js';
import { BASILISK } from '../constants/creature-types.js';
import { REASONABLE } from '../helpers/costs.js';

export interface EcdysisCardOptions extends CardOptions {
	boosts?: Array<{ prop: string; amount: number }>;
}

export class EcdysisCard extends BaseCard<EcdysisCardOptions> {
	static cardClass = [BOOST];
	static cardType = 'Ecdysis';
	static permittedClassesAndTypes = [BASILISK];
	static description = 'Evolve into your more perfect form.';
	static level = 2;
	static cost = REASONABLE.cost;
	static probability = COMMON.probability;
	static defaults = {
		boosts: [
			{ prop: 'dex', amount: 1 },
			{ prop: 'str', amount: 1 },
		],
	};

	constructor({
		boosts,
		icon = '📶',
		...rest
	}: Partial<EcdysisCardOptions> = {}) {
		super({ boosts, icon, ...rest } as Partial<EcdysisCardOptions>);
	}

	get boosts(): Array<{ prop: string; amount: number }> {
		return (this.options as EcdysisCardOptions).boosts!;
	}

	get stats(): string {
		return this.boosts.map(boost => `Boost: ${boost.prop} +${boost.amount}`).join('\r');
	}

	override getTargets(player: any): any[] {
		return [player];
	}

	effect(player: any, target: any): any {
		this.boosts.forEach(boost => target.setModifier(boost.prop, boost.amount));
		return !player.dead;
	}
}

export default EcdysisCard;
