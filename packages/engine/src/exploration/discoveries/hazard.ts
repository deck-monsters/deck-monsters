import BaseDiscoveryCard from './base.js';
import chance from '../../helpers/chance.js';
import { flavor } from '../../helpers/flavor.js';

const { roll } = chance;
const getFlavor = flavor.getFlavor.bind(flavor);
import { capitalize } from '../../helpers/capitalize.js';
import Gladiator from '../../monsters/gladiator.js';

export class HazardCard extends BaseDiscoveryCard {
	damage: number;
	flavor: any;

	constructor({
		monster = new Gladiator({ name: 'default', color: 'gray', gender: 'androgynous' }),
		damageDice,
		icon = '⚠️',
		icons,
	}: {
		monster?: any;
		damageDice?: string;
		icon?: string;
		icons?: any;
	} = {}) {
		super({ damageDice, icon, icons });

		this.damage = Math.min(roll({ primaryDice: this.damageDice }).result, 4);
		const flavors = this.getDamageFlavors(monster, this.damage - 1);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.flavor = getFlavor('hazards' as any, flavors as any);
		(this as any).icon = this.flavor.icon;
		(this as any).flavorText = ' ';
	}

	get damageDice(): string {
		return (this.options as any).damageDice;
	}

	set damageDice(damageDice: string) {
		this.setOptions({ damageDice } as any);
	}

	get stats(): string {
		return `${this.flavor.text} ${this.damage} damage.`;
	}

	getDamageFlavors(
		player: any,
		number: number
	): Record<string, Array<[string, number, string]>> {
		const damageFlavors: Array<Array<[string, number, string]>> = [
			[
				['is caught in a sudden thunderstorm, and pummeled with hail for', 10, '⛈'],
				[`stubs ${player.pronouns.his} toe on a rock for`, 50, '👣'],
				['steps on a jagged stick and takes', 50, '👣'],
				[`finds ${player.pronouns.him}self caught in briars and takes`, 50, '🌵'],
				['walks through a patch of stinging nettles and takes', 50, '🌿'],
				['is eaten up by mosquitos for', 60, '🐜'],
				['is bitten by a large spider for', 40, '🕷'],
				['eats some mildly rotten trail rations and falls ill for', 5, '🤢'],
				[`is terribly frightened by ${player.pronouns.his} own ghost and takes`, 1, '👻'],
			],
			[
				['is caught in a sudden windstorm, hit by debris and branches, and takes', 20, '🌬'],
				['stumbles through some poison ivy and takes', 50, '🍂'],
				['walks through a patch of saw grass and takes', 50, '🌾'],
				[`trips, falls, and scrapes ${player.pronouns.his} hands and knees for`, 80, '🚷'],
				['is pelted with acorns by an angry squirrel for', 40, '🐿'],
				['is taken by surprise by a fast moving cold-front and suffers from mild exposure for', 20, '❄️'],
				['gets in a fight with a troll over a disagreement about bridge fees, and is immediately tossed into the river for', 1, '👹'],
			],
			[
				['falls into a hole and takes', 20, '🕳'],
				[`hits ${player.pronouns.his} head on a low hanging branch for`, 80, '🌳'],
				['is pelted with stones and walnuts by a troop of territorial monkeys for', 40, '🐒'],
				['is stung by a scorpion for', 40, '🦂'],
				['gets a particularly bad sunburn and receives', 65, '☀️'],
				['is caught in a freak blizzard and gets mild frost-bite for', 10, '☃️'],
				['is chased by goblins and pelted with rocks and sticks and receives', 1, '👺'],
			],
			[
				[`is burnt by ${player.pronouns.his} camp fire for`, 50, '🔥'],
				['is caught in a sudden forest fire and takes', 20, '🔥'],
				["steps on a hornet's nest and is stung repeatedly for", 40, '🐝'],
				[`is caught off guard by a wild boar who, before dissapearing back into the foliage, rams ${player.pronouns.him} for`, 70, '🐗'],
				['eats a bad mushroom and takes', 30, '🍄'],
				[`is struck by --I kid you not-- a meteorite. ${capitalize(player.pronouns.he)} watched in stunned awe as a fireball roared towards ${player.pronouns.him} through the sky. At first it narrowly missed ${player.pronouns.him}, but then it bounced off of a nearby tree, hit and ricocheted off of (and sadly killed) a bird in flight, before the thumb-sized rock finally glanced off of ${player.pronouns.his} shoulder for`, 1, '☄️'],
			],
		];

		return { hazards: damageFlavors[number] };
	}

	async effect(_environment: any, monster: any): Promise<boolean> {
		await monster.hit(this.damage, _environment, this);

		return !monster.dead;
	}
}

(HazardCard as any).cardType = 'Hazard';
(HazardCard as any).probability = 10;
(HazardCard as any).description = "It's dangerous out there. Your monster...";
(HazardCard as any).defaults = {
	damageDice: '1d4',
};

export default HazardCard;
