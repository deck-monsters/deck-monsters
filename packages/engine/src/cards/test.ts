import { BaseCard, type CardOptions } from './base.js';
import { MELEE } from '../constants/card-classes.js';

export class TestCard extends BaseCard {
	static cardClass = [MELEE];
	static cardType = 'Test';
	static probability = 100;
	static description = 'For testing purposes only.';
	static cost = 10;

	constructor({
		targets,
		icon = '',
	}: Partial<CardOptions> & { targets?: any[] } = {}) {
		super({ icon } as Partial<CardOptions>);
		if (targets) {
			this.setOptions({ targets } as any);
		}
	}

	set targets(targets: any[]) {
		this.setOptions({ targets } as any);
	}

	get targets(): any[] {
		return (this.options as any).targets;
	}

	override getTargets(_player: any, proposedTarget: any): any[] {
		return this.targets || [proposedTarget];
	}

	effect(player: any, target: any, _ring?: any): any {
		player.played = (player.played || 0) + 1;
		target.targeted = (target.targeted || 0) + 1;

		if (this.original) {
			(this.original as any).played = ((this.original as any).played || 0) + 1;
		} else {
			(this as any).played = ((this as any).played || 0) + 1;
		}

		return true;
	}
}

export default TestCard;
