import type { registerHandler } from './index.js';

const cleanMonsterName = (monsterName?: string): string | undefined => {
	if (!monsterName || monsterName === 'monster') return undefined;
	return monsterName.trim().replace(/^monster\s+/i, '');
};

const cleanPresetName = (presetName?: string): string => (presetName ?? '').trim();

const SAVE_PRESET_REGEX = /save preset (.+?) for (?:a )?(.+?)$/i;
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

const LOAD_PRESET_REGEX = /load preset (.+?) on (?:a )?(.+?)$/i;
function loadPresetAction({ channel, character, game, isDM, results }: any): Promise<unknown> {
	if (!isDM) {
		return Promise.reject(new Error('Please talk to me in a direct message'));
	}

	return Promise.resolve()
		.then(() =>
			character.loadPreset({
				channel,
				presetName: cleanPresetName(results[1]),
				monsterName: cleanMonsterName(results[2]),
			}),
		)
		.catch((err: unknown) => game.log(err));
}

const DELETE_PRESET_REGEX = /delete preset (.+?) for (?:a )?(.+?)$/i;
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
