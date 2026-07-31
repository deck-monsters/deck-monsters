import type { BaseCreature, ChannelFn } from './base.js';

export function editSelf(creature: BaseCreature, channel: ChannelFn): Promise<unknown> {
	const allowedKeys = ['givenName', 'icon'] as const;
	type AllowedKey = typeof allowedKeys[number];

	return Promise.resolve()
		.then(() => channel({
			question:
`Which field would you like to update?

0) Name (currently: ${creature.givenName})
1) Icon/color (currently: ${creature.icon})`,
			choices: [`Name (currently: ${creature.givenName})`, `Icon/color (currently: ${creature.icon})`]
		}))
		.then((answer: unknown) => {
			const key: AllowedKey = Number(answer) === 0 ? 'givenName' : 'icon';
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
	return Promise
		.resolve()
		.then(() => (creature as unknown as Record<string, unknown>).look && (creature as unknown as { look: (ch: ChannelFn) => unknown }).look(channel))
		.then(() => channel({
			question: `Which attribute would you like to edit?`,
			choices: optionKeys.map(key => `${key} (${JSON.stringify(creature.options[key])})`)
		}))
		.then(index => optionKeys[index as unknown as number])
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
