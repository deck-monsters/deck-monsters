import { expect } from 'chai';

import PRONOUNS from '../../helpers/pronouns.js';
import allMonsters from './all.js';
import spawnMonster, { spawnHelpersReady } from './spawn.js';
import { LOOKS, lookPreview, lookQuestion, lookQuestionShort } from './looks.js';

const GENDERS = Object.keys(PRONOUNS) as (keyof typeof PRONOUNS)[];
// Odd on purpose: starts with a vowel and a capital, and has a comma and a hyphen, so the
// article picked by the Weeping Angel and any case change would show up.
const LOOKS_TO_TRY = ['ember red', 'Ivory, with a dark-red head'];

describe('monsters/helpers/looks', () => {
	before(async () => {
		await spawnHelpersReady;
	});

	it('has an entry for every monster type', () => {
		const types = allMonsters.map(M => (M as any).creatureType);
		expect(Object.keys(LOOKS).sort()).to.deep.equal([...types].sort());
	});

	it('asks exactly what the Console asked before the table existed', () => {
		// Frozen from the old if/else chain in askForColor.
		expect(lookQuestion('Dragon', PRONOUNS.female)).to.equal(
			'What should her scales look like? (eg: deep-sea blue with an ember-red belly)',
		);
		expect(lookQuestion('Basilisk', PRONOUNS.male)).to.equal(
			'What should his skin look like? (eg: gold and black diamond patterned)',
		);
		expect(lookQuestion('Weeping Angel', PRONOUNS.androgynous)).to.equal(
			'What should their raiment be? (eg: deceptively glorious)',
		);
		expect(lookQuestion('Something Else', PRONOUNS.male)).to.equal(
			'What should his clothing look like? (eg: blue)',
		);
		expect(lookQuestion('Jinn')).to.equal('What should their nascent form be? (eg: slightly translucent blue)');
	});

	it('is the question the Console really sends, for every type and pronoun set', async () => {
		for (const Monster of allMonsters) {
			for (const gender of GENDERS) {
				const questions: string[] = [];
				await spawnMonster(async ({ question }: { question?: string }) => {
					questions.push(question as string);
					return 'teal';
				}, { type: allMonsters.indexOf(Monster), gender, name: 'Rex' });
				expect(questions, `${(Monster as any).creatureType} ${gender}`).to.deep.equal([
					lookQuestion((Monster as any).creatureType, PRONOUNS[gender]),
				]);
			}
		}
	});

	it('gives the web the same question without the example', () => {
		for (const Monster of allMonsters) {
			const type = (Monster as any).creatureType;
			for (const gender of GENDERS) {
				const full = lookQuestion(type, PRONOUNS[gender]);
				const short = lookQuestionShort(type, PRONOUNS[gender]);
				expect(short.endsWith('?'), short).to.equal(true);
				expect(short).to.not.include('eg:');
				expect(full.startsWith(short), full).to.equal(true);
				expect(full).to.equal(`${short} (eg: ${LOOKS[type].example})`);
			}
		}
	});

	/**
	 * The preview must be what the description prints. A description embeds the look mid-sentence,
	 * so the comparison drops the preview's full stop and the case of its first letter (the
	 * description starts lower-case: "a ... figure", and `upperFirst` is applied when it is shown).
	 * Everything else must match character for character, including the pronoun.
	 */
	const printedBy = (description: string, preview: string): boolean => {
		const fragment = preview.replace(/\.$/, '');
		const lowered = fragment.charAt(0).toLowerCase() + fragment.slice(1);
		return description.includes(fragment) || description.includes(lowered);
	};

	for (const Monster of allMonsters) {
		const type = (Monster as any).creatureType as string;
		describe(type, () => {
			for (const gender of GENDERS) {
				for (const look of LOOKS_TO_TRY) {
					it(`previews ${look} for ${gender} as the description prints it`, () => {
						const monster: any = new (Monster as any)({ color: look, gender });
						const preview = lookPreview(type, look, PRONOUNS[gender]);
						expect(preview.endsWith('.'), preview).to.equal(true);
						expect(preview.charAt(0), preview).to.equal(preview.charAt(0).toUpperCase());
						if (type === 'Basilisk') {
							// The description wedges a size before the look and a home after it
							// ("a hulking, {look}, forest-dwelling basilisk"), so the preview keeps
							// only the look and the noun. Check the look sits between them, in order.
							expect(preview).to.equal(`A ${look} basilisk.`);
							expect(monster.description).to.match(
								new RegExp(`^a [^,]+, ${look.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, [^ ]+-dwelling basilisk`),
							);
						} else {
							expect(printedBy(monster.description, preview), `${preview} in: ${monster.description}`).to.equal(true);
						}
					});
				}
			}
		});
	}

	it('uses the speaker\'s pronoun where the description does, and "their" with none', () => {
		expect(lookPreview('Dragon', 'ember red', PRONOUNS.female)).to.equal('Her scales are ember red.');
		expect(lookPreview('Unicorn', 'white', PRONOUNS.male)).to.equal('His coat is white.');
		expect(lookPreview('Unicorn', 'white')).to.equal('Their coat is white.');
	});

	it('previews an unknown type as just the look', () => {
		expect(lookPreview('Something Else', 'blue')).to.equal('Blue.');
	});
});
