import { BasePotion, type BasePotionOptions } from '../potions/base.js';

export type BaseScrollOptions = BasePotionOptions;

export class BaseScroll<TOptions extends BaseScrollOptions = BaseScrollOptions> extends BasePotion<TOptions> {
	constructor(options?: Partial<TOptions>) {
		super(options);

		if (this.name === BaseScroll.name) {
			throw new Error('The BaseScroll should not be instantiated directly!');
		}
	}

	get scrollType(): string {
		return this.itemType;
	}
}

(BaseScroll as any).eventPrefix = 'scroll';

export default BaseScroll;
