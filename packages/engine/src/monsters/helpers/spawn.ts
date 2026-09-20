import PRONOUNS, { PRONOUN_CHOICES, PRONOUN_KEYS, genderFromPronounChoice } from '../../helpers/pronouns.js';
import names from '../../helpers/names.js';
import { BASILISK, GLADIATOR, JINN, MINOTAUR, WEEPING_ANGEL } from '../../constants/creature-types.js';
import { announceAndThrow } from '../../helpers/announce-and-throw.js';
import type { ChannelFn, CardInstance } from '../../creatures/base.js';
import type BaseMonster from '../base.js';
import allMonsters from './all.js';
// The answer contract (0-based index from web, label text from Discord) lives in
// exactly one place. This used to be a per-file copy behind the lazy loader below,
// and three copies of a rule that must agree is how the shop menus drifted out of
// sync in the first place (docs/prompt-answer-contract.md, bug #143). Imported
// statically: choices.js pulls in only leaf helpers (card, upper-first,
// probabilities, collection, items/helpers/counts) and never reaches back into
// monsters/characters, so there is no cycle here for a lazy load to avoid.
import { resolveChoiceIndex } from '../../helpers/choices.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MonsterConstructor = new (options?: Record<string, unknown>) => BaseMonster & { [key: string]: any };

// These formatters stay behind the lazy loader only because the loader (and the
// readiness promise it exports, which helpers/engine-ready.ts aggregates) is a
// pre-existing pattern shared with equip.ts/hydrate.ts. There is no circular
// dependency to avoid here: choices.js reaches only leaf helpers, which is why the
// static import above is safe. Collapsing these onto it too is a fine follow-up,
// but it changes the exported readiness contract, so it is deliberately not done
// in the same change as the answer-contract de-duplication.
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

export const spawnHelpersReady = loadHelpers().catch((err) => {
	console.error('[engine] spawnHelpersReady FAILED — spawn helpers will be stubs:', err);
});

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

	const askForCreatureType = (): Promise<MonsterConstructor> => {
		const creatureTypeLabels = allMonsters.map(m => (m as any).creatureType ?? (m as any).name ?? 'Unknown');

		return Promise.resolve()
			.then(() => {
				if (type !== undefined) return type;

				return channel({
					question: `Which type of monster would you like to train?`,
					choices: creatureTypeLabels,
				});
			})
			.then((answer: unknown) => {
				// The Discord connector answers with the button's label text, never an index
				// (see docs/prompt-answer-contract.md) — resolve either form and fail loudly
				// on garbage rather than let `allMonsters[NaN]` return `undefined` silently.
				const index = resolveChoiceIndex(answer, creatureTypeLabels);
				const Monster = allMonsters[index];
				if (!Monster) {
					return announceAndThrow(channel, `I don't recognize "${String(answer)}" as a monster type.`);
				}
				return Monster as MonsterConstructor;
			});
	};

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

	const askForGender = (_Monster: MonsterConstructor): Promise<Record<string, unknown>> => {
		if (gender !== undefined) {
			if (!PRONOUN_KEYS.includes(gender as typeof PRONOUN_KEYS[number])) {
				return announceAndThrow(channel, `Unknown monster gender: ${String(gender)}`);
			}
			options.gender = gender;
			return Promise.resolve(options);
		}

		return Promise.resolve().then(() => channel({
			question: 'Which pronouns should we use for your monster?',
			choices: [...PRONOUN_CHOICES],
		})).then((answer: unknown) => {
			const selectedGender = genderFromPronounChoice(answer);
			if (!selectedGender) {
				return announceAndThrow(channel, `Unknown monster pronoun choice: ${String(answer)}`);
			}
			options.gender = selectedGender;
			return options;
		});
	};

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
