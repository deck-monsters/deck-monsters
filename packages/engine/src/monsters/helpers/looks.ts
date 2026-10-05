import { BASILISK, DRAGON, GLADIATOR, JINN, MINOTAUR, UNICORN, WEEPING_ANGEL } from '../../constants/creature-types.js';
import { capitalize } from '../../helpers/capitalize.js';

/**
 * The one look question per creature type: what the player is asked, an example answer, and
 * the line the monster's description will print for it. The Console's `askForColor`
 * (`spawn.ts`) and the web training wizard both read this, so the two cannot word it
 * differently. It used to be an if/else chain inside `askForColor`.
 *
 * Browser-safe on purpose (constants and `capitalize` only).
 *
 * `preview` reuses the words of the type's `description` getter around the look, so what the
 * player sees while typing is what the finished monster reads like. `looks.test.ts` builds
 * every real monster and checks that, which is what keeps it honest when a description is
 * reworded. It previews the look line only: a Dragon's wings or a Unicorn's witness are drawn
 * when the monster is made, so they are not in it.
 */
export interface LookPronouns {
	his?: string;
}

export interface LookEntry {
	/** Finishes "What should {his} …?" */
	descriptor: string;
	/** A sample answer, shown as "(eg: …)" in the Console and as the web input's placeholder. */
	example: string;
	/** The look as a standalone sentence, the way the description prints it. */
	preview: (look: string, pronouns?: LookPronouns) => string;
}

const his = (pronouns?: LookPronouns): string => capitalize(pronouns?.his ?? 'their');

/** A or An, by the look's first letter, as the Weeping Angel's description picks it. */
const article = (look: string): string => (look.charAt(0).match(/[aeiou]/i) ? 'An' : 'A');

/** What an unknown type is asked (and what every type was asked before it had its own). */
export const DEFAULT_LOOK: LookEntry = {
	descriptor: 'clothing look like',
	example: 'blue',
	preview: look => `${capitalize(look)}.`,
};

export const LOOKS: Readonly<Record<string, LookEntry>> = {
	[BASILISK]: {
		descriptor: 'skin look like',
		example: 'gold and black diamond patterned',
		// The description puts a size before the look and a home after it
		// ("a hulking, {look}, forest-dwelling basilisk"), so the preview leaves them out.
		preview: look => `A ${look} basilisk.`,
	},
	[MINOTAUR]: {
		descriptor: 'skin and hair look like',
		example: 'scarred, wrinkled, and beautifully auburn',
		preview: look => `A battle-hardened, ${look} minotaur.`,
	},
	[GLADIATOR]: {
		descriptor: 'garments look like',
		example: 'tattered rags',
		preview: look => `Dressed in ${look}.`,
	},
	[WEEPING_ANGEL]: {
		descriptor: 'raiment be',
		example: 'deceptively glorious',
		preview: look => `${article(look)} ${look} weeping angel.`,
	},
	[JINN]: {
		descriptor: 'nascent form be',
		example: 'slightly translucent blue',
		preview: look => `A ${look} figure.`,
	},
	[UNICORN]: {
		descriptor: 'coat look like',
		example: 'ivory white with a dark-red head',
		preview: (look, pronouns) => `${his(pronouns)} coat is ${look}.`,
	},
	[DRAGON]: {
		descriptor: 'scales look like',
		example: 'deep-sea blue with an ember-red belly',
		preview: (look, pronouns) => `${his(pronouns)} scales are ${look}.`,
	},
};

/** The entry for a type, or the default for a type with none. Own keys only (`constructor` is no type). */
export const lookEntry = (type: string | undefined): LookEntry =>
	type !== undefined && Object.hasOwn(LOOKS, type) ? LOOKS[type] : DEFAULT_LOOK;

/** The Console's question, byte for byte: `What should her scales look like? (eg: …)`. */
export const lookQuestion = (type: string | undefined, pronouns?: LookPronouns): string => {
	const { descriptor, example } = lookEntry(type);
	return `What should ${pronouns?.his ?? 'their'} ${descriptor}? (eg: ${example})`;
};

/** The same question without the example, for the web, which shows the example as a placeholder. */
export const lookQuestionShort = (type: string | undefined, pronouns?: LookPronouns): string =>
	`What should ${pronouns?.his ?? 'their'} ${lookEntry(type).descriptor}?`;

/** The look as the description prints it: the sentence for the type, with the look filled in. */
export const lookPreview = (type: string | undefined, look: string, pronouns?: LookPronouns): string =>
	lookEntry(type).preview(look, pronouns);
