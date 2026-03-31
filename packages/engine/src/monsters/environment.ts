import { sample } from '../helpers/random.js';
import BaseMonster from './base.js';

const DEFAULT_COLOR = 'stony green';

const PATTERNS = ['hill covered', 'swamp ridden', 'flat and featureless'];

const DESCRIPTORS = ['terrifying', 'cold', 'stark', 'barren'];

class Environment extends BaseMonster {
	constructor(options: Record<string, unknown> = {}) {
		const defaultOptions = {
			damageModifier: 0,
			color: DEFAULT_COLOR,
			pattern: sample(PATTERNS),
			descriptor: sample(DESCRIPTORS),
			icon: '🌎',
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
		return `before you is a ${this.color} ${this.pattern} landscape. As ${this.descriptor} as it is beckoning. What you most need is where you most fear to go.`;
	}
}

Environment.creatureType = 'The World';
Environment.class = 'wilderness';
(Environment as any).acVariance = 0;
(Environment as any).hpVariance = 0;
(Environment as any).description = `
The world. In all its terror and beauty.
`;

export { Environment };
export default Environment;
