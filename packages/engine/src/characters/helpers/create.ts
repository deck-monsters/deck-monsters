import PRONOUNS from '../../helpers/pronouns.js';
import names from '../../helpers/names.js';
import type { ChannelFn } from '../../creatures/base.js';
import type BaseCharacter from '../base.js';
import allCharacters from './all.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CharacterConstructor = new (options?: Record<string, unknown>) => BaseCharacter & { [key: string]: any };

let _getChoices: (arr: string[]) => string = arr =>
	arr.map((c, i) => `${i}) ${c}`).join('\n');
let _getCreatureTypeChoices: (creatures: CharacterConstructor[]) => string = creatures =>
	creatures.map((c, i) => `${i}) ${(c as any).creatureType ?? c.name}`).join('\n');
let _randomEmoji: () => string = () => '🎲';

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

const genders = Object.keys(PRONOUNS);

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

	const iconChoices: string[] = [];
	for (let i = 0; i < 7; i++) {
		iconChoices.push(_randomEmoji());
	}

	const askForCreatureType = (): Promise<CharacterConstructor> =>
		Promise.resolve()
			.then(() => {
				if (type !== undefined) return type;
				return channel({
					question: `Which type of character would you like to be?`,
					choices: (allCharacters as CharacterConstructor[]).map(c => (c as any).creatureType ?? c.name),
				});
			})
			.then((answer: unknown) => allCharacters[answer as number] as CharacterConstructor);

	const askForGender = (Character: CharacterConstructor): Promise<Record<string, unknown>> =>
		Promise.resolve()
			.then(() => {
				if (gender !== undefined) return gender;
				return channel({
					question: `What gender should your ${((Character as any).creatureType as string).toLowerCase()} be?`,
					choices: genders,
				});
			})
			.then((answer: unknown) => {
				options.gender = genders[answer as number].toLowerCase();
				return options;
			});

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

	const askForAvatar = (): Promise<Record<string, unknown>> =>
		Promise.resolve()
			.then(() => {
				if (icon !== undefined) return icon;
				return channel({
					question: `Finally, choose an avatar:`,
					choices: iconChoices,
				});
			})
			.then((answer: unknown) => {
				options.icon = iconChoices[answer as number];
				return options;
			});

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
