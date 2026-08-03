import { BaseCard, type CardOptions } from '../base.js';

export interface UnknownCardSource {
	name?: string;
	options?: Record<string, unknown>;
}

export interface UnknownCardOptions extends CardOptions {
	/** Original class name from the serialized save (e.g. a renamed/removed card). */
	originalName: string;
	/** Original options blob from the serialized save, kept for admin repair. */
	originalOptions: Record<string, unknown>;
}

/**
 * Inert placeholder for a serialized card whose class is no longer in the catalog.
 * Preserves original identity/data for repair, stays visible in decks, and no-ops in combat.
 */
export class UnknownCard extends BaseCard<UnknownCardOptions> {
	static cardType = 'Unknown Card';
	static description =
		'This card could not be restored from a saved game. It is inert in combat but kept in the deck so the original data can be repaired.';
	static notForSale = true;
	static neverForSale = true;
	static probability = 0;
	static level = 0;
	static cost = 0;

	constructor(cardObj: UnknownCardSource) {
		const originalName = cardObj?.name ?? 'Unknown';
		const originalOptions =
			cardObj?.options && typeof cardObj.options === 'object'
				? { ...cardObj.options }
				: {};

		super({
			icon: typeof originalOptions.icon === 'string' ? originalOptions.icon : '❓',
			originalName,
			originalOptions,
		} as Partial<UnknownCardOptions>);
	}

	/** Expose the original serialized class name so lookups/matching stay repairable. */
	override get name(): string {
		return (this.options as UnknownCardOptions).originalName;
	}

	override get cardType(): string {
		return `Unknown Card (${this.name})`;
	}

	override get itemType(): string {
		return this.cardType;
	}

	get stats(): string {
		return `Inert placeholder — original class "${this.name}" is missing from the catalog.`;
	}

	/** Serialize back as the original card identity, never as UnknownCard. */
	override toJSON(): { name: string; options: Record<string, unknown> } {
		const originalOptions = (this.options as UnknownCardOptions).originalOptions ?? {};
		return {
			name: this.name,
			options: { ...originalOptions },
		};
	}
}

export default UnknownCard;
