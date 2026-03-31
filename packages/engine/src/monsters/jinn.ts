import { sample } from '../helpers/random.js';
import { BARD } from '../constants/creature-classes.js';
import { JINN } from '../constants/creature-types.js';
import BaseMonster from './base.js';

const DEFAULT_COLOR = 'fiery red';

const ANIMALS = ['black dog', 'coyote', 'goat', 'crow', 'lamp'];

const DESCRIPTORS = ['lurks', 'sulks', 'tip-toes', 'hides'];

class Jinn extends BaseMonster {
	constructor(options: Record<string, unknown> = {}) {
		const defaultOptions = {
			dexModifier: 1,
			strModifier: 0,
			intModifier: 1,
			color: DEFAULT_COLOR,
			animal: sample(ANIMALS),
			descriptor: sample(DESCRIPTORS),
			icon: '🕌',
		};

		super(Object.assign(defaultOptions, options));
	}

	get color(): string {
		return this.options.color as string;
	}

	get animal(): string {
		return this.options.animal as string;
	}

	get descriptor(): string {
		return this.options.descriptor as string;
	}

	get description(): string {
		const { pronouns } = this;
		return `a ${this.color} figure ${this.descriptor} in the dusty shadows at the corner of your vision. At first you think it might be human and you wonder who or what ${pronouns.he} is. What is ${pronouns.he} thinking about? When you turn to look closer all you see is a ${this.animal} and a gently settling cloud of sand.`;
	}
}

Jinn.creatureType = JINN;
Jinn.class = BARD;
(Jinn as any).acVariance = 2;
(Jinn as any).hpVariance = 0;
(Jinn as any).description = `
Jinn are not purely spiritual, but also physical in nature, being able to interact in a tactile manner with people and objects and also subject to bodily desires like eating and sleeping. Generally jinn lack individuality and are thought to appear in mists or standstorms, but when they materialize in different forms they may gain individuality. Individual jinn are commonly depicted as monstrous and anthropomorphized creatures with body parts from different animals or human with animalic traits. Their speed, cunning, and amorphous nature makes them difficult to catch a glimpse of against their will.
`;

export { Jinn };
export default Jinn;
