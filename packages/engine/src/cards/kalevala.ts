import { HitCard } from './hit.js';
import { ACOUSTIC, PSYCHIC } from '../constants/card-classes.js';
import { VERY_RARE } from '../helpers/probabilities.js';
import { PRICEY } from '../helpers/costs.js';

const damageLevels = ['1d4', '1d6', '1d8', '2d4', '2d6', '2d8'];

export class KalevalaCard extends HitCard {
	static cardClass = [ACOUSTIC, PSYCHIC];
	static cardType = 'The Kalevala';
	static probability = VERY_RARE.probability;
	static description =
		'Steadfast old Väinämöinen himself fashioned this instrument of eternal joy. Tune its pikebone pegs and it may lead you on to victory.';
	static level = 1;
	static cost = PRICEY.cost;
	static noBosses = true;
	static notForSale = true;
	static neverForSale = true;
	static defaults = {
		...HitCard.defaults,
		damageDice: damageLevels[0],
		targetProp: 'int',
	};
	static flavors = {
		hits: [
			['plucks a mighty tune for', 80],
			['plays a sweet song for', 70],
			['sonically thrashes', 70],
			['produces joyous music in the presence of', 50],
			['hath played the mighty Kalevala and will never fear', 5],
		],
	};

	constructor({
		damageDice,
		icon = '🎻',
		...rest
	}: Record<string, any> = {}) {
		super({ damageDice, icon, ...rest } as any);
	}

	override get itemType(): string {
		return `${(this.constructor as any).cardType} (${this.damageDice})`;
	}

	levelUp(amount: number): void {
		if (this.damageDice !== damageLevels[damageLevels.length - 1]) {
			let index = damageLevels.indexOf(this.damageDice) + amount;
			if (index >= damageLevels.length) index = damageLevels.length - 1;

			const damageDice = damageLevels[index];

			if (damageDice) {
				this.setOptions({ damageDice } as any);

				if (this.original) {
					(this.original as any).setOptions({ damageDice });
				}

				this.emit('narration', {
					narration: `✨ *This kalevala has levelled up.* ✨\nIt will now do ${this.damageDice} damage.`,
				});
			}
		}
	}

	override hitCheck(player: any, target: any): any {
		const result = super.hitCheck(player, target);

		if (result.strokeOfLuck) {
			this.levelUp(1);
		}

		return result;
	}
}

export default KalevalaCard;
