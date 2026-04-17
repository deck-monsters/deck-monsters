import BaseDiscoveryCard from './base.js';

export class DeathCard extends BaseDiscoveryCard {
	constructor({ icon = '💀' }: { icon?: string } = {}) {
		super({ icon });
	}

	get stats(): string {
		return (this as any).flavor;
	}

	async effect(_environment: any, monster: any): Promise<boolean> {
		await monster.die(_environment);

		return !monster.dead;
	}
}

(DeathCard as any).cardType = 'Death';
(DeathCard as any).probability = 1;
(DeathCard as any).description = 'It is dangerous out there...';

(DeathCard as any).flavors = {
	death: [['Your monster mistakenly eats some green potatoes', 100]],
};

export default DeathCard;
