import { monsterCard } from './card.js';
import { getItemKey } from '../items/helpers/counts.js';

const getChoices = (array: string[]): string =>
	array.map((choice, index) => `${index}) ${choice}`).join('\n');

/**
 * Resolves a raw prompt answer against the SAME labels array a `getChoices`-rendered
 * question was built from, and returns the 0-based index of the match, or -1 when the
 * answer matches nothing.
 *
 * This is the one place that decodes an answer for a small, fixed, hand-dispatched menu
 * (see docs/reference/prompt-answer-contract.md for the full protocol). Accepting both forms matters
 * because the two connectors disagree on what they send back: the web client's
 * `InlineChoices` component always answers with the 0-based index as a string (see
 * `apps/web/src/components/InlineChoices.tsx`), while the Discord connector's buttons use
 * the choice's *label* text as the button `customId` and resolve with that label verbatim
 * (see `packages/connector-discord/src/prompt-handler.ts`). A menu that only checked
 * `Number(answer)` therefore worked for one connector and silently mis-routed the other.
 *
 * A hand-written numbered menu (`1) Foo\n2) Bar`) that dispatches on a literal `1`/`2`
 * comparison is exactly how the buy/sell shop menus drifted from this 0-based convention
 * and silently routed "Items" to the Back Room — see docs/roadmap/10b-bugs-fixed.md. Always
 * render choice text with `getChoices`/`getFinalItemChoices` etc. and resolve answers with
 * this helper (or the equivalent label-or-index matching in `items/helpers/choose.ts`) so
 * the question text and the dispatch logic can never disagree again.
 */
const resolveChoiceIndex = (answer: unknown, labels: string[]): number => {
	const trimmed = String(answer ?? '').trim();
	if (!trimmed) return -1;

	if (/^\d+$/.test(trimmed)) {
		const index = Number(trimmed);
		return index >= 0 && index < labels.length ? index : -1;
	}

	return labels.findIndex(label => label.toLowerCase() === trimmed.toLowerCase());
};

const getItemChoices = (items: Record<string, unknown>): string =>
	getChoices(Object.keys(items).map(item => `${item} [${items[item]}]`));

const getItemChoicesWithPrice = (
	items: Record<string, { count: unknown; cost: unknown }>
): string =>
	getChoices(
		Object.keys(items).map(item => `${item} [${items[item].count}] - ${items[item].cost} coins`)
	);

const getFinalItemChoices = (items: Array<Record<string, unknown>>): string =>
	getChoices(items.map(item => getItemKey(item)));

const getMonsterChoices = (monsters: Array<Record<string, unknown>>): string =>
	getChoices(monsters.map(monster => monsterCard(monster as Parameters<typeof monsterCard>[0], false)));

const getCreatureTypeChoices = (creatures: Array<{ creatureType?: string }>): string =>
	getChoices(creatures.map(creature => creature.creatureType ?? ''));

const getAttributeChoices = (options: Record<string, unknown>): string =>
	getChoices(
		Object.keys(options).map(key => `${key} (${JSON.stringify(options[key])})`)
	);

export {
	getAttributeChoices,
	getItemChoices as getCardChoices,
	getChoices,
	getCreatureTypeChoices,
	getFinalItemChoices as getFinalCardChoices,
	getFinalItemChoices,
	getItemChoices,
	getItemChoicesWithPrice,
	getMonsterChoices,
	resolveChoiceIndex
};
