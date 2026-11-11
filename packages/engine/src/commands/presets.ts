import type { registerHandler } from './index.js';
import { presetTakeQuestion } from '../characters/helpers/equip-message.js';
import { resolveChoiceIndex } from '../helpers/choices.js';

const TAKE_CHOICES = ['Yes', 'No'];

/**
 * Asks whether to take cards off the player's other monsters, and returns true for yes. An
 * ordinary engine prompt is right here (the Console flow is interactive); the web Workshop
 * cannot use one and asks in the UI instead, see docs/architecture/workshop-and-items.md.
 *
 * Rule 4 of the prompt/answer contract: a console line is the open prompt's answer, so a
 * command typed mid-prompt ("send Brass to the ring") must not be read as yes OR as no.
 * Declining still loads the preset, so reading junk as "no" would quietly change the hand
 * the player never asked to change. Unrecognised answers ask again, and a cancel aborts the
 * flow (`PROMPT_CANCELLED` passes straight through the channel). The re-ask has no cap: it
 * cannot strand a player, and every prompt times out on the bus.
 */
async function confirmTakes(channel: (message: Record<string, unknown>) => unknown, question: string): Promise<boolean> {
	for (;;) {
		// eslint-disable-next-line no-await-in-loop
		const answer = await channel({ question, choices: TAKE_CHOICES });
		const index = resolveChoiceIndex(answer, TAKE_CHOICES);
		if (index === 0) return true;
		if (index === 1) return false;
		// eslint-disable-next-line no-await-in-loop
		await channel({ announce: 'Please answer Yes or No.' }); // DRAFT(39)
	}
}

// The preset-name capture is greedy so the LAST separator splits the command.
// With a lazy capture, `save preset tank for bosses for Stonefang` parsed as
// preset "tank" / monster "bosses for Stonefang". A separator word is far more
// likely inside a player-chosen preset name than inside a monster's given name,
// which is the single trailing token, so splitting on the last one is correct.

const cleanMonsterName = (monsterName?: string): string | undefined => {
	if (!monsterName || monsterName === 'monster') return undefined;
	return monsterName.trim().replace(/^monster\s+/i, '');
};

const cleanPresetName = (presetName?: string): string => (presetName ?? '').trim();

const SAVE_PRESET_REGEX = /save preset (.+) for (?:a )?(.+?)$/i;
function savePresetAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve()
		.then(() =>
			character.savePreset({
				channel,
				presetName: cleanPresetName(results[1]),
				monsterName: cleanMonsterName(results[2]),
			}),
		)
		.catch((err: unknown) => game.log(err));
}

const LOAD_PRESET_REGEX = /load preset (.+) on (?:a )?(.+?)$/i;
function loadPresetAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve()
		.then(async () => {
			const presetName = cleanPresetName(results[1]);
			// Resolve the monster first (it asks which one when none is named) so the
			// confirmation can name it.
			const monster = await character.chooseMonster({
				channel,
				monsterName: cleanMonsterName(results[2]),
				action: 'load a preset for',
			});
			const takes = character.suggestPresetTakes({
				presetName,
				monsterName: monster.givenName,
				ring: game.ring,
			}) as Array<{ cardName: string; fromMonsterName: string }>;
			const takeFrom = takes.length > 0
				&& await confirmTakes(channel, presetTakeQuestion({ monsterName: monster.givenName, takes }))
				? takes.map(({ cardName, fromMonsterName }) => ({ monsterName: fromMonsterName, cardName }))
				: undefined;
			return character.loadPreset({ channel, presetName, monsterName: monster.givenName, takeFrom, ring: game.ring });
		})
		.catch((err: unknown) => game.log(err));
}

const DELETE_PRESET_REGEX = /delete preset (.+) for (?:a )?(.+?)$/i;
function deletePresetAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve()
		.then(() =>
			character.deletePreset({
				channel,
				presetName: cleanPresetName(results[1]),
				monsterName: cleanMonsterName(results[2]),
			}),
		)
		.catch((err: unknown) => game.log(err));
}

const LOOK_AT_PRESETS_REGEX = /look at presets(?: for (?:a )?(.+?))?$/i;
function lookAtPresetsAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve()
		.then(() => {
			const monsterName = cleanMonsterName(results[1]);
			const presets = character.getPresets(monsterName);
			const lines: string[] = ['Presets'];

			if (monsterName) {
				lines.push(`for ${monsterName}:`);
				const entries = Object.entries(presets as Record<string, string[]>);
				if (entries.length < 1) {
					lines.push('  (none)');
				} else {
					entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([preset, cards]) => {
						lines.push(`  ${preset}: ${cards.join(', ') || '(empty)'}`);
					});
				}
				return channel({ announce: lines.join('\n') });
			}

			const grouped = presets as Record<string, Record<string, string[]>>;
			const monsters = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
			if (monsters.length < 1) {
				lines.push('(none)');
				return channel({ announce: lines.join('\n') });
			}

			monsters.forEach((monster) => {
				lines.push('');
				lines.push(`${monster}:`);
				const entries = Object.entries(grouped[monster] ?? {});
				if (entries.length < 1) {
					lines.push('  (none)');
					return;
				}
				entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([preset, cards]) => {
					lines.push(`  ${preset}: ${cards.join(', ') || '(empty)'}`);
				});
			});
			return channel({ announce: lines.join('\n') });
		})
		.catch((err: unknown) => game.log(err));
}

export default function presetHandlers(registerHandlerFn: typeof registerHandler): void {
	registerHandlerFn(SAVE_PRESET_REGEX, savePresetAction);
	registerHandlerFn(LOAD_PRESET_REGEX, loadPresetAction);
	registerHandlerFn(DELETE_PRESET_REGEX, deletePresetAction);
	registerHandlerFn(LOOK_AT_PRESETS_REGEX, lookAtPresetsAction);
}
