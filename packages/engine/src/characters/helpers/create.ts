import PRONOUNS, { PRONOUN_CHOICES, PRONOUN_KEYS, genderFromPronounChoice } from '../../helpers/pronouns.js';
import names from '../../helpers/names.js';
import { announceAndThrow } from '../../helpers/announce-and-throw.js';
import type { ChannelFn } from '../../creatures/base.js';
import type BaseCharacter from '../base.js';
import allCharacters from './all.js';
// The answer contract (0-based index from web, label text from Discord) lives in
// exactly one place. This used to be a per-file copy behind the lazy loader below,
// and three copies of a rule that must agree is how the shop menus drifted out of
// sync in the first place (docs/prompt-answer-contract.md, bug #143). Imported
// statically: choices.js pulls in only leaf helpers (card, upper-first,
// probabilities, collection, items/helpers/counts) and never reaches back into
// monsters/characters, so there is no cycle here for a lazy load to avoid.
import { resolveChoiceIndex } from '../../helpers/choices.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CharacterConstructor = new (options?: Record<string, unknown>) => BaseCharacter & { [key: string]: any };

let _getChoices: (arr: string[]) => string = arr =>
	arr.map((c, i) => `${i}) ${c}`).join('\n');
let _getCreatureTypeChoices: (creatures: CharacterConstructor[]) => string = creatures =>
	creatures.map((c, i) => `${i}) ${(c as any).creatureType ?? c.name}`).join('\n');
// The web asks for choices before the optional emoji module finishes loading; this fallback
// must still make seven distinct radios rather than seven duplicate dice.
const FALLBACK_AVATARS = ['🎲', '🦊', '🐙', '🦉', '🐍', '🦁', '🐲'] as const;
let fallbackAvatarIndex = 0;
let _randomEmoji: () => string = () => {
	const avatar = FALLBACK_AVATARS[fallbackAvatarIndex % FALLBACK_AVATARS.length]!;
	fallbackAvatarIndex += 1;
	return avatar;
};

const loadHelpers = async () => {
	const [choicesModule, emojiModule] = await Promise.all([
		import('../../helpers/choices.js').catch(() => null),
		import('node-emoji').catch(() => null),
	]);
	if (choicesModule) {
		_getChoices = (choicesModule as any).getChoices ?? _getChoices;
		_getCreatureTypeChoices =
			(choicesModule as any).getCreatureTypeChoices ?? _getCreatureTypeChoices;
	}
	if (emojiModule) {
		const emoji = (emojiModule as any).default ?? emojiModule;
		if (emoji?.random) {
			_randomEmoji = () => emoji.random().emoji;
		}
	}
};

export const createHelperReady = loadHelpers().catch((err) => {
	console.error('[engine] createHelperReady FAILED — character creation helpers will be stubs:', err);
});

/**
 * The avatar choices the console prompt offers. Exported so a non-interactive caller (the
 * web workshop's first-run character form) can present the same picker instead of growing
 * a second emoji source that drifts away from this one.
 */
export const randomAvatarChoices = (count: number): string[] => {
	const choices: string[] = [];
	const maxDraws = Math.max(count * 10, 10);
	for (let draws = 0; choices.length < count && draws < maxDraws; draws++) {
		const avatar = _randomEmoji();
		if (!choices.includes(avatar)) choices.push(avatar);
	}
	return choices;
};

interface CreateCharacterOptions {
	type?: number | string;
	name?: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	game?: any;
	gender?: string;
	icon?: string;
}

const createCharacter = (
	channel: ChannelFn,
	{ type, name, game, gender, icon }: CreateCharacterOptions = {},
): Promise<BaseCharacter> => {
	const options: Record<string, unknown> = {};

	const askForCreatureType = (): Promise<CharacterConstructor> => {
		const creatureTypeLabels = (allCharacters as CharacterConstructor[]).map(c => (c as any).creatureType ?? c.name);

		return Promise.resolve()
			.then(() => {
				if (type !== undefined) return type;
				// `allCharacters` has exactly one entry today, so this prompt was asking a
				// brand-new player to pick "Beastmaster" out of a list of one before they
				// could do anything at all — a question with no wrong answer, asked first.
				// Take the only class instead. The prompt below is deliberately left intact
				// for the day a second class lands; delete this branch then, not the question.
				if (allCharacters.length === 1) return 0;
				return channel({
					question: `Which type of character would you like to be?`,
					choices: creatureTypeLabels,
				});
			})
			.then((answer: unknown) => {
				// The Discord connector answers with the button's label text, never an index
				// (see docs/prompt-answer-contract.md) — resolve either form and fail loudly
				// on garbage rather than let `allCharacters[NaN]` return `undefined` silently.
				const index = resolveChoiceIndex(answer, creatureTypeLabels);
				const Character = allCharacters[index] as CharacterConstructor;
				if (!Character) {
					return announceAndThrow(channel, `I don't recognize "${String(answer)}" as a character type.`);
				}
				return Character;
			});
	};

	const askForGender = (_Character: CharacterConstructor): Promise<Record<string, unknown>> => {
		if (gender !== undefined) {
			if (!PRONOUN_KEYS.includes(gender as typeof PRONOUN_KEYS[number])) {
				return announceAndThrow(channel, `I don't recognize "${String(gender)}" as a pronoun choice.`);
			}
			options.gender = gender;
			return Promise.resolve(options);
		}

		return Promise.resolve().then(() => channel({
			question: 'Which pronouns should we use for you?',
			choices: [...PRONOUN_CHOICES],
		})).then((answer: unknown) => {
			const selectedGender = genderFromPronounChoice(answer);
			if (!selectedGender) {
				return announceAndThrow(channel, `I don't recognize "${String(answer)}" as a pronoun choice.`);
			}
			options.gender = selectedGender;
			return options;
		});
	};

	const askForName = (
		Character: CharacterConstructor,
		alreadyTaken = false,
	): Promise<Record<string, unknown>> =>
		Promise.resolve()
			.then(() => {
				if (name !== undefined && !alreadyTaken) return name;

				let question = '';
				if (alreadyTaken) question += 'That name is already taken, please choose a different name. ';

				const name1 = names((Character as any).creatureType, options.gender as string);
				const name2 = names((Character as any).creatureType, options.gender as string, [name1]);

				const pronounSet = (PRONOUNS as any)[(options.gender as string) ?? 'male'];
				question += `What would you like to name ${pronounSet?.him ?? 'them'}? ${name1}? ${name2}? Something else?`;

				return channel({ question });
			})
			.then((answer: unknown) => {
				if (game && game.findCharacterByName(answer as string)) {
					return askForName(Character, true);
				}
				options.name = answer as string;
				return options;
			});

	const askForAvatar = (): Promise<Record<string, unknown>> => {
		// A supplied icon is the emoji itself, not an answer to the prompt below. It used
		// to be resolved against `iconChoices` like an answer, and those are seven *random*
		// emoji — so a caller that supplied an avatar was rejected ("I don't recognize
		// 🦊 as an avatar choice") unless its pick happened to appear in that random
		// seven. Nothing supplied an icon before the workshop's first-run form did, which
		// is why this went unnoticed.
		if (icon !== undefined) {
			options.icon = icon;
			return Promise.resolve(options);
		}

		const iconChoices = randomAvatarChoices(7);
		return Promise.resolve()
			.then(() =>
				channel({
					question: `Finally, choose an avatar:`,
					choices: iconChoices,
				}),
			)
			.then((answer: unknown) => {
				// Same label-or-index ambiguity as askForCreatureType above.
				const index = resolveChoiceIndex(answer, iconChoices);
				const selectedIcon = iconChoices[index];
				if (!selectedIcon) {
					return announceAndThrow(channel, `I don't recognize "${String(answer)}" as an avatar choice.`);
				}
				options.icon = selectedIcon;
				return options;
			});
	};

	let Character: CharacterConstructor;

	return Promise.resolve()
		.then(askForCreatureType)
		.then((Type) => {
			Character = Type;
			return Character;
		})
		.then(() => askForGender(Character))
		.then(() => askForName(Character))
		.then(() => askForAvatar())
		.then(() => new Character(options));
};

export { createCharacter };
export default createCharacter;
