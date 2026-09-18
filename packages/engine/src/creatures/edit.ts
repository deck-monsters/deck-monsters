import { resolveChoiceIndex } from '../helpers/choices.js';
import { announceAndThrow } from '../helpers/announce-and-throw.js';
import type { BaseCreature, ChannelFn } from './base.js';

export function editSelf(creature: BaseCreature, channel: ChannelFn): Promise<unknown> {
	// The display name is "Name" but the underlying option key is `name` (see the
	// `givenName` getter in creatures/base.ts, which reads `this.options.name`). This used
	// to be hardcoded to 'givenName', a key that getOptions/setOptions never actually reads
	// or writes to — every "Name" edit through this flow silently set a stray `givenName`
	// option instead of the `name` the getter uses, so the rename never took effect. Found
	// while generalising this same block's choice-answer handling.
	const allowedKeys = ['name', 'icon'] as const;
	type AllowedKey = typeof allowedKeys[number];

	const fieldLabels = [`Name (currently: ${creature.givenName})`, `Icon/color (currently: ${creature.icon})`];

	return Promise.resolve()
		.then(() => channel({
			question:
`Which field would you like to update?

0) Name (currently: ${creature.givenName})
1) Icon/color (currently: ${creature.icon})`,
			choices: fieldLabels
		}))
		.then((answer: unknown) => {
			// The Discord connector answers with the button's label text, never an index
			// (see docs/prompt-answer-contract.md) — resolve either form and fail loudly on
			// garbage rather than default to 'icon' for anything that isn't literally 0.
			const index = resolveChoiceIndex(answer, fieldLabels);
			if (index !== 0 && index !== 1) {
				return announceAndThrow(channel, `I don't recognize "${String(answer)}" as a field to edit.`);
			}
			const key: AllowedKey = index === 0 ? 'name' : 'icon';
			const current = creature.options[key];
			return (channel({
				question: `The current value of ${key} is ${JSON.stringify(current)}. What would you like the new value to be?`
			}) as Promise<string>).then((strVal: string) => ({ key, oldVal: current, newVal: strVal.trim() }));
		})
		.then(({ key, oldVal, newVal }: { key: AllowedKey; oldVal: unknown; newVal: string }) =>
			(channel({
				question: `Update ${key} from ${JSON.stringify(oldVal)} to ${JSON.stringify(newVal)}? (yes/no)`
			}) as Promise<string>).then((answer = '') => {
				if (answer.toLowerCase() === 'yes') {
					creature.setOptions({ [key]: newVal });
					return channel({ announce: 'Change saved.' });
				}
				return channel({ announce: 'Change reverted.' });
			})
		);
}

export function edit(creature: BaseCreature, channel: ChannelFn): Promise<unknown> {
	const optionKeys = Object.keys(creature.options);
	const attributeLabels = optionKeys.map(key => `${key} (${JSON.stringify(creature.options[key])})`);

	return Promise
		.resolve()
		.then(() => (creature as unknown as Record<string, unknown>).look && (creature as unknown as { look: (ch: ChannelFn) => unknown }).look(channel))
		.then(() => channel({
			question: `Which attribute would you like to edit?`,
			choices: attributeLabels
		}))
		.then((answer: unknown) => {
			// The Discord connector answers with the button's label text, never an index
			// (see docs/prompt-answer-contract.md) — resolve either form and fail loudly on
			// garbage rather than let `optionKeys[NaN]` return `undefined` and propagate into
			// every question below as the literal string "undefined".
			const index = resolveChoiceIndex(answer, attributeLabels);
			const key = optionKeys[index];
			if (!key) {
				return announceAndThrow(channel, `I don't recognize "${String(answer)}" as an attribute.`);
			}
			return key;
		})
		.then(key => (channel({
			question:
`The current value of ${key} is ${JSON.stringify(creature.options[key])}. What would you like the new value of ${key} to be?`
		}) as Promise<string>)
			.then((strVal: string) => {
				const oldVal = creature.options[key];
				let newVal: unknown;

				try {
					newVal = JSON.parse(strVal);
				} catch (ex) {
					newVal = +strVal;
					if (isNaN(newVal as number)) newVal = strVal;
				}

				return { key, oldVal, newVal };
			}))
		.then(({ key, oldVal, newVal }: { key: string; oldVal: unknown; newVal: unknown }) => (channel({
			question:
`The value of ${key} has been updated from ${JSON.stringify(oldVal)} to ${JSON.stringify(newVal)}. Would you like to keep this change? (yes/no)`
		}) as Promise<string>)
			.then((answer = '') => {
				if (answer.toLowerCase() === 'yes') {
					creature.setOptions({ [key]: newVal });
					return channel({ announce: 'Change saved.' });
				}
				return channel({ announce: 'Change reverted.' });
			}));
}
