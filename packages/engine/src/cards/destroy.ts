import { BaseCard, type CardOptions } from './base.js';
import { IMPOSSIBLE } from '../helpers/probabilities.js';
import { MELEE } from '../constants/card-classes.js';

export class DestroyCard extends BaseCard {
	static cardClass = [MELEE];
	static cardType = 'Destroy';
	static probability = IMPOSSIBLE.probability;
	static description =
		'A test card used to completely destroy your opponent.';
	static level = 0;
	static cost = 9999999999999;
	static notForSale = true;
	static defaults = {
		damage: 9999999999999,
		levelDamage: 1,
	};
	static flavors = {
		hits: [['annihilates', 100]],
	};

	constructor({
		damage,
		icon = '☠️',
		levelDamage,
	}: Partial<CardOptions> & { damage?: number; levelDamage?: number } = {}) {
		super({ damage, icon, levelDamage } as any);
	}

	get damage(): number {
		return (this.options as any).damage;
	}

	get levelDamage(): number {
		return (this.options as any).levelDamage;
	}

	get stats(): string {
		return 'Destroy: Annihilates your opponent';
	}

	effect(player: any, target: any, _ring: any, activeContestants: any): any {
		const damage = this.damage + this.levelDamage * player.level;
		return Promise.all(
			activeContestants.map(({ monster }: any) => {
				if (monster !== player) {
					return monster.hit(damage, player, this);
				}
				return Promise.resolve();
			})
		).then(() => !target.dead);
	}
}

export default DestroyCard;
