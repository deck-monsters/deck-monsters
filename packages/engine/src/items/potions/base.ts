import { BaseItem, type BaseItemOptions, type UseOptions } from '../base.js';

export interface BasePotionOptions extends BaseItemOptions {}

export class BasePotion<TOptions extends BasePotionOptions = BasePotionOptions> extends BaseItem<TOptions> {
	constructor(options?: Partial<TOptions>) {
		super(options);

		if (this.name === BasePotion.name) {
			throw new Error('The BasePotion should not be instantiated directly!');
		}
	}

	get potionType(): string {
		return this.itemType;
	}

	get numberOfUses(): number | undefined {
		return (this.constructor as any).numberOfUses;
	}

	get expired(): boolean {
		const { numberOfUses, used = 0 } = this;
		return !!(numberOfUses && used >= numberOfUses);
	}

	get stats(): string {
		const { numberOfUses } = this;

		if (this.expired) {
			return 'All used up!';
		} else if (numberOfUses === 1) {
			return 'Usable 1 time.';
		} else if (numberOfUses !== undefined && numberOfUses > 1) {
			let usesLeft = `${numberOfUses} times`;
			if (this.used) {
				usesLeft = `${numberOfUses - this.used} more times (of ${numberOfUses} total)`;
			}

			return `Usable ${usesLeft}.`;
		}

		return 'Usable an unlimited number of times.';
	}

	use({ channel, channelName, character, monster }: UseOptions): Promise<any> {
		return Promise.resolve()
			.then(() => {
				if (this.expired) {
					return channel({
						announce: `This ${this.itemType} is expired and cannot be used.`
					});
				}

				return super.use({ channel, channelName, character, monster });
			})
			.then((result: any) => {
				if (result) {
					this.used += 1;
				}

				if (this.expired) {
					if (!monster?.removeItem(this)) {
						character.removeItem(this);
					}
				}

				return result;
			});
	}
}

(BasePotion as any).eventPrefix = 'potion';

export default BasePotion;
