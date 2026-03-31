import { BaseCard, type CardOptions } from './base.js';
import { random } from '../helpers/random.js';
import { AOE, POISON } from '../constants/card-classes.js';
import { EPIC } from '../helpers/probabilities.js';
import { EXPENSIVE } from '../helpers/costs.js';
import {
	TARGET_ALL_CONTESTANTS,
	getTarget,
} from '../helpers/targeting-strategies.js';

export class PrionDiseaseCard extends BaseCard {
	static cardClass = [POISON, AOE];
	static cardType = '1993-09-7202 18:58';
	static probability = EPIC.probability;
	static description = 'Buy a questionable round of milkshakes for everyone.';
	static level = 2;
	static cost = EXPENSIVE.cost;
	static notForSale = true;
	static flavors = {
		hits: [
			['gives prion disease to', 80],
			['poisons', 70],
			['calls user ( ˃ ヮ˂) to give a history lesson to', 5],
			['invokes an ancient ascii art joke against', 5],
		],
	};

	constructor({ icon = '旦' }: Partial<CardOptions> = {}) {
		super({ icon } as Partial<CardOptions>);
	}

	getHPModifier(player: any, target: any): number {
		let modification = random(0, 3);

		if (target === player) {
			if (random(1, 100) === 13) {
				modification = -target.hp;
			} else {
				modification++;
			}
		} else if (random(1, 50) === 13) {
			modification = -target.hp;
		}

		return modification;
	}

	get stats(): string {
		return `Serve everyone a nice round of milkshakes!\nUsually restores between 0-3hp to each opponent, and 1-4hp for the player.\n1:50 chance to kill each opponent.\n1:100 chance to kill yourself.`;
	}

	override getTargets(
		player: any,
		_proposedTarget: any,
		_ring: any,
		activeContestants: any
	): any[] {
		return (getTarget({
			contestants: activeContestants,
			ignoreSelf: false,
			playerMonster: player,
			strategy: TARGET_ALL_CONTESTANTS,
			team: false,
		}) as any[]).map(({ monster }: any) => monster);
	}

	effect(player: any, target: any): any {
		const hpChange = this.getHPModifier(player, target);
		let narration = `
　　∧,,,∧
　 （ ・ω・） ${target.givenName} likes milkshake!
　　( つ旦O
　　と＿)_)

　　∧,,,∧
　 （ ・◎・） slrrrp
　　(　ﾞノ ヾ
　　と＿)_)

`;

		if (hpChange < 0) {
			narration += `
　　∧,,,∧
　 （ ・ω・） Hmm, tastes like prion disease...
　　( つ旦O
　　と＿)_)
`;
		} else {
			let hearts = '';
			for (let i = 0; i < hpChange; i++) {
				hearts += '♥︎';
			}
			narration += `
　　∧,,,∧
　 （ ・ω・） tastes delicious!
　　( つ旦O   ${hearts}
　　と＿)_)
`;
		}

		this.emit('narration', { narration });

		if (hpChange < 0) {
			return target.hit(-hpChange, player, this);
		} else if (hpChange > 0) {
			return target.heal(hpChange, player, this);
		}

		return true;
	}
}

export default PrionDiseaseCard;
