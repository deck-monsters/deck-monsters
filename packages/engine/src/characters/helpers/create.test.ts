import { expect } from 'chai';
import emoji from 'node-emoji';
import sinon from 'sinon';

import createCharacter, { CHARACTER_NAME_MAX_LENGTH, createHelperReady, randomAvatarChoices } from './create.js';
import { CommandRefusalError } from '../../helpers/command-refusal-error.js';

// Each createCharacter() call with no options prompts, in order: pronouns, name, avatar.
// The creature-type prompt is skipped while there is exactly one class to choose from
// (see create.ts), so a supplied `type` is what exercises that step. A sequenced channel
// stub that returns canned answers (and records what each prompt asked and offered) lets
// each test target one prompt without having to special-case the others.
const makeSequencedChannel = (answers: unknown[]) => {
	const seenChoices: (string[] | undefined)[] = [];
	const seenQuestions: string[] = [];
	const channel = async (message: any = {}) => {
		seenChoices.push(message.choices);
		if (message.question) seenQuestions.push(message.question);
		return answers.shift();
	};
	return { channel, seenChoices, seenQuestions };
};

describe('characters/helpers/create', () => {
	before(async () => {
		await createHelperReady;
	});

	describe('askForCreatureType (via createCharacter)', () => {
		// `type` is supplied in these three because the prompt itself is skipped while
		// there is only one class — the index/label resolution still has to hold for the
		// values connectors send once the prompt comes back.
		it('resolves a numeric index answer, the shape the web client sends', async () => {
			const { channel } = makeSequencedChannel(['she/her', 'Saffron', '0']);
			const character = await createCharacter(channel, { type: '0' });

			expect(character.creatureType).to.equal('Beastmaster');
		});

		it('resolves a label answer, the shape the Discord connector sends', async () => {
			const { channel } = makeSequencedChannel(['she/her', 'Saffron', '0']);
			const character = await createCharacter(channel, { type: 'Beastmaster' });

			expect(character.creatureType).to.equal('Beastmaster');
		});

		it('rejects an unrecognised creature type answer instead of creating undefined', async () => {
			const { channel } = makeSequencedChannel([]);
			let error: unknown;
			try {
				await createCharacter(channel, { type: 'Not A Character' });
			} catch (caught) {
				error = caught;
			}

			expect(error).to.be.instanceOf(CommandRefusalError);
			expect((error as Error).message).to.include('Not A Character');
		});

		/*
		 * `helpers/all.ts` has exactly one entry, so the opening question of the whole
		 * game was "Which type of character would you like to be?" over a list of one —
		 * a decision the player cannot make wrong, asked before they have done anything.
		 */
		it('does not ask which class when there is only one to choose from', async () => {
			const { channel, seenQuestions } = makeSequencedChannel(['she/her', 'Saffron', '0']);
			await createCharacter(channel);

			expect(seenQuestions.join('\n')).to.not.include('Which type of character');
		});

		it('asks for pronouns when the class question is skipped', async () => {
			const { channel, seenQuestions } = makeSequencedChannel(['she/her', 'Saffron', '0']);
			await createCharacter(channel);

			expect(seenQuestions[0]).to.equal('Which pronouns should we use for you?');
		});

		it('selects the only class without asking', async () => {
			const { channel } = makeSequencedChannel(['she/her', 'Saffron', '0']);
			const character = await createCharacter(channel);

			expect(character.creatureType).to.equal('Beastmaster');
		});
	});

	describe('randomAvatarChoices', () => {
		// Exported so the web can offer the same avatar picker the console prompt does
		// without a second emoji source drifting out of sync with this one.
		it('offers the requested number of avatars', () => {
			expect(randomAvatarChoices(7)).to.have.length(7);
		});

		it('offers only non-empty single choices', () => {
			for (const avatar of randomAvatarChoices(7)) {
				expect(avatar).to.be.a('string');
				expect(avatar.length).to.be.greaterThan(0);
			}
		});

		it('deduplicates a repeated emoji draw before showing avatar choices', () => {
			const random = Math.random;
			Math.random = () => 0;
			try {
				const choices = randomAvatarChoices(7);
				expect(new Set(choices).size).to.equal(choices.length);
			} finally {
				Math.random = random;
			}
		});
	});

	describe('askForGender (via createCharacter)', () => {
		it('resolves a label answer, the shape the Discord connector sends', async () => {
			const { channel } = makeSequencedChannel(['she/her', 'Saffron', '0']);
			const character = await createCharacter(channel);

			expect(character.gender).to.equal('female');
		});

		it('resolves a numeric index answer, the shape the web client sends', async () => {
			const { channel, seenChoices } = makeSequencedChannel(['0', 'Saffron', '0']);
			const character = await createCharacter(channel);

			expect(seenChoices[0]).to.deep.equal(['he/him', 'she/her', 'they/them']);
			expect(character.gender).to.equal('male');
		});

		it('rejects an unrecognised gender answer instead of storing undefined.toLowerCase()', async () => {
			const { channel } = makeSequencedChannel(['Not A Gender']);
			let error: unknown;
			try {
				await createCharacter(channel);
			} catch (caught) {
				error = caught;
			}

			expect(error).to.be.instanceOf(CommandRefusalError);
			expect((error as Error).message).to.include('Not A Gender');
		});

		for (const invalidGender of ['toString', '__proto__']) {
			it(`rejects inherited key "${invalidGender}" supplied by a prompt-free caller`, async () => {
				const { channel } = makeSequencedChannel([]);
				let error: unknown;
				try {
					await createCharacter(channel, {
						type: 0,
						gender: invalidGender,
						name: 'Saffron',
						icon: '🦊',
					});
				} catch (caught) {
					error = caught;
				}

				expect(error).to.be.instanceOf(CommandRefusalError);
				expect((error as Error).message).to.include(invalidGender);
			});
		}
	});

	describe('askForAvatar (via createCharacter)', () => {
		it('resolves a numeric index answer against the offered icon choices', async () => {
			const { channel, seenChoices } = makeSequencedChannel(['she/her', 'Saffron', '0']);
			const character = await createCharacter(channel);

			const iconChoices = seenChoices[2] as string[];
			expect(character.icon).to.equal(iconChoices[0]);
		});

		it('resolves a label answer against the offered icon choices', async () => {
			// The avatar's own "label" IS the emoji itself (choices double as their own labels),
			// so answering with the exact emoji text exercises the label branch of resolveChoiceIndex.
			const answers = ['she/her', 'Saffron'];
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

		/*
		 * A supplied icon is the emoji itself, not an answer to the prompt. Resolving it
		 * against the seven *random* offered choices rejected nearly every avatar a
		 * prompt-free caller could pick, and a prompt-free caller cannot be asked again.
		 */
		it('keeps a supplied avatar instead of matching it against the random choices', async () => {
			const { channel, seenQuestions } = makeSequencedChannel(['she/her', 'Saffron']);
			const character = await createCharacter(channel, { icon: '🦊' });

			expect(character.icon).to.equal('🦊');
			expect(seenQuestions.join('\n')).to.not.include('choose an avatar');
		});

		it('does not generate unused avatar choices when an icon is supplied', async () => {
			const random = sinon.stub(emoji, 'random').throws(new Error('A supplied icon must not draw avatar choices.'));
			try {
				const character = await createCharacter(async () => {
					throw new Error('A fully specified character must not prompt.');
				}, { type: 0, gender: 'female', name: 'Saffron', icon: '🦊' });
				expect(character.icon).to.equal('🦊');
			} finally {
				random.restore();
			}
		});

		it('rejects an unrecognised avatar answer instead of storing undefined', async () => {
			const { channel } = makeSequencedChannel(['she/her', 'Saffron', 'Not An Icon']);
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

	it('strips control characters from a typed character name', async () => {
		// jsonb rejects a NUL, so one in a name would stop the room saving (roadmap 37).
		const { channel } = makeSequencedChannel(['she/her', 'Saf\u0000fr\u0007on\u007f', '0']);
		const character = await createCharacter(channel, { type: '0' });

		expect(character.givenName).to.equal('Saffron');
	});

	describe('suggestedName (the Console path)', () => {
		it('asks "What should we call you?" first, offering the suggestion', async () => {
			const { channel, seenQuestions } = makeSequencedChannel(['Ada Lovelace', 'she/her', '0']);
			const character = await createCharacter(channel, { type: '0', suggestedName: 'ada' });

			expect(seenQuestions[0]).to.equal('What should we call you? Type a name, or type ok to be ada.');
			expect(seenQuestions[1]).to.equal('Which pronouns should we use for you?');
			expect(character.givenName).to.equal('Ada Lovelace');
		});

		// Nobody can send an empty message from the web Console or Discord, so the word is
		// the real-input path; the empty answer is the scripted/defensive one.
		for (const accept of ['ok', 'OK', ' Okay ', 'yes', 'Y', '  ']) {
			it(`takes the suggestion on ${JSON.stringify(accept)}`, async () => {
				const { channel } = makeSequencedChannel([accept, 'she/her', '0']);
				const character = await createCharacter(channel, { type: '0', suggestedName: 'ada' });

				expect(character.givenName).to.equal('Ada');
			});
		}

		it('asks without the ok option when the suggestion is empty after cleaning', async () => {
			const { channel, seenQuestions } = makeSequencedChannel(['ok', 'she/her', '0']);
			const character = await createCharacter(channel, { type: '0', suggestedName: '\u0000 \u0001' });

			// "ok" is then just a name, since there was nothing to accept.
			expect(seenQuestions[0]).to.equal('What should we call you? Type a name.');
			expect(character.givenName).to.equal('Ok');
		});

		it('does not offer a suggestion that is already taken', async () => {
			const game = { findCharacterByName: (n: string) => (n.toLowerCase() === 'bob' ? {} : undefined) };
			const { channel, seenQuestions } = makeSequencedChannel(['Sam', 'she/her', '0']);
			const character = await createCharacter(channel, { type: '0', suggestedName: 'Bob', game });

			expect(seenQuestions[0]).to.equal('What should we call you? Type a name.');
			expect(character.givenName).to.equal('Sam');
		});

		it('re-asks without the taken name after a clash', async () => {
			const game = { findCharacterByName: (n: string) => (n.toLowerCase() === 'bob' ? {} : undefined) };
			const { channel, seenQuestions } = makeSequencedChannel(['bob', 'Sam', 'she/her', '0']);
			const character = await createCharacter(channel, { type: '0', suggestedName: 'ada', game });

			expect(seenQuestions[1]).to.equal('That name is already taken, please choose a different name. What should we call you? Type a name.');
			expect(character.givenName).to.equal('Sam');
		});

		it('sanitizes the suggestion it offers', async () => {
			const { channel, seenQuestions } = makeSequencedChannel(['ok', 'she/her', '0']);
			await createCharacter(channel, { type: '0', suggestedName: `A\u0000da${'x'.repeat(60)}` });

			expect(seenQuestions[0]).to.equal(`What should we call you? Type a name, or type ok to be ${`Adax${'x'.repeat(36)}`}.`);
		});

		it('strips control characters and caps the length like the Workshop form', async () => {
			const long = 'x'.repeat(60);
			const { channel } = makeSequencedChannel([`Ad\u0000a${long}`, 'she/her', '0']);
			const character = await createCharacter(channel, { type: '0', suggestedName: 'ada' });

			expect(character.givenName).to.have.length(CHARACTER_NAME_MAX_LENGTH);
			expect(character.givenName.startsWith('Ada')).to.equal(true);
			expect(character.givenName).to.not.include('\u0000');
		});

		it('does not ask when a name was supplied', async () => {
			const { channel, seenQuestions } = makeSequencedChannel(['she/her', '0']);
			const character = await createCharacter(channel, { type: '0', name: 'Given', suggestedName: 'ada' });

			expect(seenQuestions).to.deep.equal(['Which pronouns should we use for you?', 'Finally, choose an avatar:']);
			expect(character.givenName).to.equal('Given');
		});
	});

	describe('starting coins', () => {
		it('gives a newly created character 30 coins', async () => {
			const { channel } = makeSequencedChannel(['she/her', 'Saffron', '0']);
			const character = await createCharacter(channel, { type: '0' });

			expect(character.coins).to.equal(30);
		});

		it('leaves the base default alone, so saved and generated characters keep what they have', async () => {
			const Beastmaster = (await import('../beastmaster.js')).default;

			expect(new Beastmaster({ name: 'Hydrated' }).coins).to.equal(0);
			expect(new Beastmaster({ name: 'Hydrated', coins: 7 }).coins).to.equal(7);
		});
	});
});
