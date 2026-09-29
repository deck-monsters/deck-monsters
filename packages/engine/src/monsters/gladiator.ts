import { sample } from '../helpers/random.js';
import { FIGHTER } from '../constants/creature-classes.js';
import { GLADIATOR } from '../constants/creature-types.js';
import BaseMonster from './base.js';

const DEFAULT_COLOR = 'leather';

const SIZES = [
	{ adjective: 'nimble', height: 'just over 5 feet' },
	{ adjective: 'powerful', height: 'a towering 6 feet' },
	{ adjective: 'stocky', height: 'a portly five and a half feet' },
	{ adjective: 'gigantic', height: 'well over 8 feet' },
];

const LOCATIONS = [
	'the Roman colosseum',
	'a dusty rural arena',
	'an underground fight club',
];

interface GladiatorSize {
	adjective: string;
	height: string;
}

class Gladiator extends BaseMonster {
	constructor(options: Record<string, unknown> = {}) {
		const defaultOptions = {
			dexModifier: 1,
			strModifier: 1,
			intModifier: 0,
			color: DEFAULT_COLOR,
			location: sample(LOCATIONS),
			size: sample(SIZES),
			icon: '💪',
		};

		super(Object.assign(defaultOptions, options));
	}

	get size(): GladiatorSize {
		return this.options.size as GladiatorSize;
	}

	get color(): string {
		return this.options.color as string;
	}

	get location(): string {
		return this.options.location as string;
	}

	get description(): string {
		const { pronouns } = this;
		return `a ${this.size.adjective} gladiator, dressed in ${this.color} and hailing from ${this.location}. Many years ago ${pronouns.he} ${pronouns.was ?? 'was'} captured, stripped of ${pronouns.his} title and land, and forced to compete in brutal matches for the entertainment of a blood-thirsty crowd. Standing ${this.size.height} tall, when you see ${pronouns.him} you know instantly that this is a warrior who has witnessed the worst humankind has to offer and has overcome.`;
	}
}

Gladiator.creatureType = GLADIATOR;
Gladiator.class = FIGHTER;
// Roadmap 35 (2026-09-28): with searched hands the Gladiator scored 39%, 37%, and 31% of
// its field at levels 1, 3, and 5, and it had no AC bonus at all (AC 7 at level 1 against
// 8-9 for most). The owner wants brutes strong early: 3 more HP (3 -> 6) and a young
// fighter's youth AC (+2 to level 3, +1 to level 6) brought it to 49%, 45%, and 37%.
(Gladiator as any).hpVariance = 6;
(Gladiator as any).youthAc = 2;
(Gladiator as any).description = `
The gladiator is a professional duelist. Many are born slaves and reared in gladiatorial schools, until such time as they earn their freedom in battle, escape, or rebel. Some join dueling academies voluntarily, seeking fame or fortune in prize fights and honor matches. Some gladiators began as warriors from faroff lands, captured in battle and forced to fight to the death, while others are condemned criminals, paying their debt to society by participating in ritual combat for the public. Whatever their station or background, the gladiator has been hardened by combat and has learned to anticipate a wily foe. While gladiatorial matches often follow a prescribed, even ritual format, the gladiator must always be ready for the possibility that they will be thrown into a situation with unusual weapons, conditions, or opponents. Some arena fighters specialize in fighting exotic animals and monsters.
`;

export { Gladiator };
export default Gladiator;
