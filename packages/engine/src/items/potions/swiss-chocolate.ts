import { ChocolateBar } from './chocolate-bar.js';
import { EPIC } from '../../helpers/probabilities.js';

export class SwissChocolate extends ChocolateBar {
	static itemType: string;
	static healAmount: number;
	static probability: number;
	static description: string;
}

SwissChocolate.itemType = 'Swiss Chocolate';
SwissChocolate.healAmount = 10;
SwissChocolate.probability = EPIC.probability;
SwissChocolate.description = `Only the finest Swiss chocolate. Restores ${SwissChocolate.healAmount} hp.`;

export default SwissChocolate;
