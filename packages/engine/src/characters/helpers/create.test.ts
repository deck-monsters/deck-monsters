import { expect } from 'chai';

import createCharacter, { createHelperReady } from './create.js';
import { CommandRefusalError } from '../../helpers/command-refusal-error.js';

// Each createCharacter() call with no options prompts, in order: creature type, gender,
// name, avatar. A sequenced channel stub that returns canned answers (and records what
// choices each prompt actually offered) lets each test target one prompt without having
// to special-case the others.
const makeSequencedChannel = (answers: unknown[]) => {
	const seenChoices: (string[] | undefined)[] = [];
	const channel = async (message: any = {}) => {
		seenChoices.push(message.choices);
		return answers.shift();
	};
	return { channel, seenChoices };
};

describe('characters/helpers/create', () => {
	before(async () => {
		await createHelperReady;
	});

	describe('askForCreatureType (via createCharacter)', () => {
		it('resolves a numeric index answer, the shape the web client sends', async () => {
			const { channel } = makeSequencedChannel(['0', 'female', 'Saffron', '0']);
			const character = await createCharacter(channel);

			expect(character.creatureType).to.equal('Beastmaster');
		});

		it('resolves a label answer, the shape the Discord connector sends', async () => {
			const { channel } = makeSequencedChannel(['Beastmaster', 'female', 'Saffron', '0']);
			const character = await createCharacter(channel);

			expect(character.creatureType).to.equal('Beastmaster');
		});

		it('rejects an unrecognised creature type answer instead of creating undefined', async () => {
			const { channel } = makeSequencedChannel(['Not A Character']);
			let error: unknown;
			try {
				await createCharacter(channel);
			} catch (caught) {
				error = caught;
			}

			expect(error).to.be.instanceOf(CommandRefusalError);
			expect((error as Error).message).to.include('Not A Character');
		});
	});

	describe('askForGender (via createCharacter)', () => {
		it('resolves a label answer, the shape the Discord connector sends', async () => {
			const { channel } = makeSequencedChannel(['Beastmaster', 'Female', 'Saffron', '0']);
			const character = await createCharacter(channel);

			expect(character.gender).to.equal('female');
		});

		it('resolves a numeric index answer, the shape the web client sends', async () => {
			// genders = Object.keys(PRONOUNS); index 0 is whichever gender PRONOUNS lists first.
			const { channel, seenChoices } = makeSequencedChannel(['Beastmaster', '0', 'Saffron', '0']);
			const character = await createCharacter(channel);

			const genderChoices = seenChoices[1] as string[];
			expect(character.gender).to.equal(genderChoices[0].toLowerCase());
		});

		it('rejects an unrecognised gender answer instead of storing undefined.toLowerCase()', async () => {
			const { channel } = makeSequencedChannel(['Beastmaster', 'Not A Gender']);
			let error: unknown;
			try {
				await createCharacter(channel);
			} catch (caught) {
				error = caught;
			}

			expect(error).to.be.instanceOf(CommandRefusalError);
			expect((error as Error).message).to.include('Not A Gender');
		});
	});

	describe('askForAvatar (via createCharacter)', () => {
		it('resolves a numeric index answer against the offered icon choices', async () => {
			const { channel, seenChoices } = makeSequencedChannel(['Beastmaster', 'female', 'Saffron', '0']);
			const character = await createCharacter(channel);

			const iconChoices = seenChoices[3] as string[];
			expect(character.icon).to.equal(iconChoices[0]);
		});

		it('resolves a label answer against the offered icon choices', async () => {
			// The avatar's own "label" IS the emoji itself (choices double as their own labels),
			// so answering with the exact emoji text exercises the label branch of resolveChoiceIndex.
			const answers = ['Beastmaster', 'female', 'Saffron'];
			const seenChoices: (string[] | undefined)[] = [];
			let iconChoices: string[] = [];

			const character = await createCharacter(async (message: any = {}) => {
				const { choices } = message;
				seenChoices.push(choices);
				if (answers.length === 0 && choices) {
					iconChoices = choices;
					return choices[2];
				}
				return answers.shift();
			});

			expect(character.icon).to.equal(iconChoices[2]);
		});

		it('rejects an unrecognised avatar answer instead of storing undefined', async () => {
			const { channel } = makeSequencedChannel(['Beastmaster', 'female', 'Saffron', 'Not An Icon']);
			let error: unknown;
			try {
				await createCharacter(channel);
			} catch (caught) {
				error = caught;
			}

			expect(error).to.be.instanceOf(CommandRefusalError);
			expect((error as Error).message).to.include('Not An Icon');
		});
	});
});
