import { sample } from '../helpers/random.js';
import { BARBARIAN } from '../constants/creature-classes.js';
import { MINOTAUR } from '../constants/creature-types.js';
import BaseMonster from './base.js';

const DEFAULT_COLOR = 'angry red';

const PATTERNS = ['crescent', 'mind-blowingly intricate', 'bold'];

const DESCRIPTORS = ['tremendous', 'awe-inspiring', 'fearsome'];

class Minotaur extends BaseMonster {
	constructor(options: Record<string, unknown> = {}) {
		const defaultOptions = {
			dexModifier: 1,
			strModifier: 2,
			intModifier: -1,
			color: DEFAULT_COLOR,
			pattern: sample(PATTERNS),
			descriptor: sample(DESCRIPTORS),
			icon: '🐗',
		};

		super(Object.assign(defaultOptions, options));
	}

	get color(): string {
		return this.options.color as string;
	}

	get pattern(): string {
		return this.options.pattern as string;
	}

	get descriptor(): string {
		return this.options.descriptor as string;
	}

	get description(): string {
		const { pronouns } = this;
		return `a battle-hardened, ${this.color} minotaur with a ${this.pattern} pattern shaved into ${pronouns.his} thick fur. Make no mistake, despite ${pronouns.his} ${this.descriptor} bulk ${pronouns.he} is a first-class host who has never been put to shame at a dinner party.`;
	}
}

Minotaur.creatureType = MINOTAUR;
Minotaur.class = BARBARIAN;
(Minotaur as any).acVariance = -1;
(Minotaur as any).hpVariance = 4;
(Minotaur as any).description = `
The bull-folk have many of the same characteristics as the bulls they resemble. Both genders have horned heads covered with shaggy hair. Warriors braid their hair with teeth or other tokens of fallen enemies. The thick hair covering their large bodies varies widely in color, from bright white to medium red-browns to dark brown and black. Many minotaurs shave or dye their fur in patterns signifying their allegiances and beliefs. Other methods of decoration include brands, ritual scars, and gilding or carving their horns.

Adult males can reach a height of 6 ½ – 7 feet, with females averaging 3 inches shorter. Both genders have a great deal of muscle mass even for their considerable size, and physical prowess plays a large part in their social structure. Minotaurs can live as long as humans but reach adulthood 3 years earlier. Childhood ends around the age of 10 and adulthood is celebrated at 15. However, most minotaurs don't form their own families until at least the age of 25. They spend those 10 years proving themselves to their elders.

Minotaurs are omnivores and consume large quantities of both meat and vegetation. Great banquets mark important social and religious occasions, and a successful feast is often a point of regional pride; competition between regional cuisines is fierce, sometimes violent, and eagerly anticipated. The minotaurs are particularly mindful of meals before great ceremonies or displays of skill, and the hosts of such events can earn nearly as much honor as the champions by providing memorable feasts. To fail as a host brings deep shame.
`;

export { Minotaur };
export default Minotaur;
