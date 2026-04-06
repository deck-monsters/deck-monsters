import PRONOUNS from '../../helpers/pronouns.js';
import names from '../../helpers/names.js';
import { BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL } from '../../constants/creature-types.js';
import type { ChannelFn, CardInstance } from '../../creatures/base.js';
import type BaseMonster from '../base.js';
import allMonsters from './all.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MonsterConstructor = new (options?: Record<string, unknown>) => BaseMonster & { [key: string]: any };

// Lazy-load choices helpers to avoid circular dependency
let _getChoices: (arr: string[]) => string = arr =>
	arr.map((c, i) => `${i}) ${c}`).join('\n');
let _getCreatureTypeChoices: (creatures: MonsterConstructor[]) => string = creatures =>
	creatures.map((c, i) => `${i}) ${(c as any).creatureType ?? c.name}`).join('\n');

const loadHelpers = async () => {
	const choicesModule = await import('../../helpers/choices.js').catch(() => null);
	if (choicesModule) {
		_getChoices = (choicesModule as any).getChoices ?? _getChoices;
		_getCreatureTypeChoices =
			(choicesModule as any).getCreatureTypeChoices ?? _getCreatureTypeChoices;
	}
};

export const spawnHelpersReady = loadHelpers().catch(() => {
	// Helpers not ready yet; stubs remain in place
});

const genders = Object.keys(PRONOUNS);

interface SpawnOptions {
	type?: number | string;
	name?: string;
	color?: string;
	gender?: string;
	cards?: CardInstance[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	game?: any;
	xp?: number;
}

const spawnMonster = (
	channel: ChannelFn,
	{
		type,
		name,
		color,
		gender,
		cards,
		game,
		xp,
	}: SpawnOptions = {},
): Promise<BaseMonster> => {
	const options: Record<string, unknown> = {};

	if (cards && cards.length > 0) options.cards = cards;
	if (xp && xp > 0) options.xp = xp;

	let monsterNames: string[] = [];
	if (game) {
		monsterNames = Object.keys(game.getAllMonstersLookup());
	}

	const askForCreatureType = (): Promise<MonsterConstructor> =>
		Promise.resolve()
			.then(() => {
				if (type !== undefined) return type;

				return channel({
					question: `Which type of monster would you like to spawn?\n\n${_getCreatureTypeChoices(allMonsters)}`,
					choices: Object.keys(allMonsters),
				});
			})
			.then((answer: unknown) => {
				const Monster = allMonsters[answer as number];
				return Monster as MonsterConstructor;
			});

	const askForName = (
		Monster: MonsterConstructor,
		alreadyTaken = false,
	): Promise<Record<string, unknown>> =>
		Promise.resolve()
			.then(() => {
				if (name !== undefined && !alreadyTaken) return name;

				let question = '';
				if (alreadyTaken) question += 'That name is already taken, please choose a different name. ';

				const name1 = names((Monster as any).creatureType, options.gender as string, monsterNames);
				const name2 = names((Monster as any).creatureType, options.gender as string, [name1, ...monsterNames]);

				question += `What would you like to name ${(PRONOUNS as any)[(options.gender as string) ?? 'male']?.him ?? 'them'}? ${name1}? ${name2}? Something else?`;

				return channel({ question });
			})
			.then((answer: unknown) => {
				if (monsterNames.includes((answer as string).toLowerCase())) {
					return askForName(Monster, true);
				}
				options.name = answer as string;
				return options;
			});

	const askForColor = (Monster: MonsterConstructor): Promise<Record<string, unknown>> =>
		Promise.resolve()
			.then(() => {
				if (color !== undefined) return color;

				let example = 'blue';
				let descriptor = 'clothing look like';

				const ct = (Monster as any).creatureType as string;
				if (ct === BASILISK) {
					example = 'gold and black diamond patterned';
					descriptor = 'skin look like';
				} else if (ct === MINOTAUR) {
					example = 'scarred, wrinkled, and beautifully auburn';
					descriptor = 'skin and hair look like';
				} else if (ct === GLADIATOR) {
					example = 'tattered rags';
					descriptor = 'garments look like';
				} else if (ct === WEEPING_ANGEL) {
					example = 'deceptively glorious';
					descriptor = 'raiment be';
				} else if (ct === JINN) {
					example = 'slightly translucent blue';
					descriptor = 'nascent form be';
				}

				const pronounSet = (PRONOUNS as any)[(options.gender as string) ?? 'male'];
				return channel({
					question: `What should ${pronounSet?.his ?? 'their'} ${descriptor}? (eg: ${example})`,
				});
			})
			.then((answer: unknown) => {
				options.color = (answer as string).toLowerCase();
				return options;
			});

	const askForGender = (Monster: MonsterConstructor): Promise<Record<string, unknown>> =>
		Promise.resolve()
			.then(() => {
				if (gender !== undefined) return gender;

				return channel({
					question: `What gender should your ${((Monster as any).creatureType as string).toLowerCase()} be?\n\n${_getChoices(genders)}`,
					choices: Object.keys(genders),
				});
			})
			.then((answer: unknown) => {
				options.gender = genders[answer as number].toLowerCase();
				return options;
			});

	let Monster: MonsterConstructor;

	return Promise.resolve()
		.then(askForCreatureType)
		.then((Type) => {
			Monster = Type;
			return Monster;
		})
		.then(() => askForGender(Monster))
		.then(() => askForName(Monster))
		.then(() => askForColor(Monster))
		.then(() => new Monster(options));
};

export { spawnMonster };
export default spawnMonster;
