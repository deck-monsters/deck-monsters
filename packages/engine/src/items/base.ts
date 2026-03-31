import { BaseClass, type BaseClassOptions } from '../shared/baseClass.js';
import { itemCard } from '../helpers/card.js';

export interface BaseItemOptions extends BaseClassOptions {
	icon?: string;
	used?: number;
	flavors?: string[];
}

export interface BaseItemStatic {
	eventPrefix: string;
	itemType: string;
	description?: string;
	icon?: string;
	cost?: number;
	level?: number;
	permittedClassesAndTypes?: string[];
	probability?: number;
	flavors?: string[];
	usableWithoutMonster?: boolean;
	notForSale?: boolean;
	neverForSale?: boolean;
}

export interface UseOptions {
	channel: any;
	channelName?: string;
	character: any;
	monster?: any;
}

export class BaseItem<TOptions extends BaseItemOptions = BaseItemOptions> extends BaseClass<TOptions> {
	constructor(options?: Partial<TOptions>) {
		super(options);

		if (this.name === BaseItem.name) {
			throw new Error('The BaseItem should not be instantiated directly!');
		}
	}

	get itemType(): string {
		return (this.constructor as unknown as BaseItemStatic).itemType;
	}

	get description(): string | undefined {
		return (this.constructor as unknown as BaseItemStatic).description;
	}

	get icon(): string {
		return (this.options as BaseItemOptions).icon ?? (this.constructor as unknown as BaseItemStatic).icon ?? '';
	}

	set icon(icon: string) {
		this.setOptions({ icon } as unknown as Partial<TOptions>);
	}

	get cost(): number {
		return (this.constructor as unknown as BaseItemStatic).cost ?? 0;
	}

	get level(): number | undefined {
		return (this.constructor as unknown as BaseItemStatic).level;
	}

	get permittedClassesAndTypes(): string[] | undefined {
		return (this.constructor as unknown as BaseItemStatic).permittedClassesAndTypes;
	}

	get probability(): number | undefined {
		return (this.constructor as unknown as BaseItemStatic).probability;
	}

	get flavors(): string[] | undefined {
		return (this.constructor as unknown as BaseItemStatic).flavors ?? (this.options as BaseItemOptions).flavors;
	}

	get used(): number {
		return (this.options as BaseItemOptions).used ?? 0;
	}

	set used(used: number) {
		this.setOptions({ used } as unknown as Partial<TOptions>);
	}

	get usableWithoutMonster(): boolean {
		return !!(this.constructor as unknown as BaseItemStatic).usableWithoutMonster;
	}

	use({ channel, channelName, character, monster }: UseOptions): Promise<any> {
		return Promise.resolve(channel)
			.then(({ channelManager }: any = {}) => channelManager?.sendMessages())
			.then(() => {
				if (!this.usableWithoutMonster && !monster) {
					return Promise.reject(channel({
						announce: `${this.itemType} must be used on a monster.`
					}));
				}

				this.emit('used', {
					channel,
					channelName,
					character,
					monster
				});

				if (typeof (this as any).action === 'function') {
					return (this as any).action({ channel, channelName, character, monster });
				}

				this.used += 1;
				return this.used;
			});
	}

	look(channel: any, verbose?: boolean): Promise<void> {
		return Promise
			.resolve()
			.then(() => channel({
				announce: itemCard(this, verbose)
			}));
	}
}

(BaseItem as unknown as BaseItemStatic).eventPrefix = 'item';

export default BaseItem;
