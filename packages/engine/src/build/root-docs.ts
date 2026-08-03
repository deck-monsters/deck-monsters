import { writeFileSync } from 'node:fs';

import { generateCardCatalogue } from './card-catalogue.js';
import { DM_ONLY_MARKERS } from './dm-only-sections.js';
import { collectDungeonMasterGuideMarkdown } from './dungeon-master-guide.js';
import { buildMonsterEntry } from './monster-manual.js';
import allMonsters from '../monsters/helpers/all.js';
import { generateCardCatalogueHtml } from './card-catalogue-html.js';
import { collectPlayerHandbookMarkdown } from './player-handbook-content.js';

export { DM_ONLY_MARKERS };
export { FILE_ONLY_OPERATOR_MARKERS } from './dm-only-sections.js';

type Collector = string[];

const collectSections = async (generate: (output: (section: string) => Promise<void>) => Promise<void>): Promise<string> => {
	const sections: Collector = [];
	await generate(section => {
		sections.push(section);
		return Promise.resolve();
	});

	return sections.join('\n');
};

export const normalizeLineEndings = (content: string): string =>
	content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const DMG_ASCII_HEADER = `
\`\`\`
			██████╗ ███╗   ███╗ ██████╗
			██╔══██╗████╗ ████║██╔════╝
			██║  ██║██╔████╔██║██║  ███╗
			██║  ██║██║╚██╔╝██║██║   ██║
			██████╔╝██║ ╚═╝ ██║╚██████╔╝
			╚═════╝ ╚═╝     ╚═╝ ╚═════╝

*Dungeon Master Guide (Game Master Reference):*
Full card stats, modifier math, damage-per-turn tables, and probability breakdowns.

Multi-roll attacks (Lucky Strike, Horn Swipe, Rehit): when a card rolls
more than once and keeps only one result, Stroke of Luck / Curse of Loki
apply to the selected roll only — discarded natural 20s/1s do not crit.
\`\`\`
`.trim();

const CARDS_ASCII_HEADER = `
\`\`\`
			.------..------..------..------..------.
			|C.--. ||A.--. ||R.--. ||D.--. ||S.--. |
			| :/\\: || (\\/) || :(): || :/\\: || :/\\: |
			| :\\/: || :\\/: || ()() || (__) || :\\/: |
			| '--'C|| '--'A|| '--'R|| '--'D|| '--'S|
			\`------'\`------'\`------'\`------'\`------'
\`\`\`
`.trim();

const MONSTERS_ASCII_HEADER = `
\`\`\`

 ███▄ ▄███▓ ▒█████   ███▄    █   ██████ ▄▄▄█████▓▓█████  ██▀███
▓██▒▀█▀ ██▒▒██▒  ██▒ ██ ▀█   █ ▒██    ▒ ▓  ██▒ ▓▒▓█   ▀ ▓██ ▒ ██▒
▓██    ▓██░▒██░  ██▒▓██  ▀█ ██▒░ ▓██▄   ▒ ▓██░ ▒░▒███   ▓██ ░▄█ ▒
▒██    ▒██ ▒██   ██░▓██▒  ▐▌██▒  ▒   ██▒░ ▓██▓ ░ ▒▓█  ▄ ▒██▀▀█▄
▒██▒   ░██▒░ ████▓▒░▒██░   ▓██░▒██████▒▒  ▒██▒ ░ ░▒████▒░██▓ ▒██▒
░ ▒░   ░  ░░ ▒░▒░▒░ ░ ▒░   ▒ ▒ ▒ ▒▓▒ ▒ ░  ▒ ░░   ░░ ▒░ ░░ ▒▓ ░▒▓░
░  ░      ░  ░ ▒ ▒░ ░ ░░   ░ ▒░░ ░▒  ░ ░    ░     ░ ░  ░  ░▒ ░ ▒░
░      ░   ░ ░ ░ ▒     ░   ░ ░ ░  ░  ░    ░         ░     ░░   ░
       ░       ░ ░           ░       ░              ░  ░   ░

    ███▄ ▄███▓ ▄▄▄       ███▄    █  █    ██  ▄▄▄       ██▓
   ▓██▒▀█▀ ██▒▒████▄     ██ ▀█   █  ██  ▓██▒▒████▄    ▓██▒
   ▓██    ▓██░▒██  ▀█▄  ▓██  ▀█ ██▒▓██  ▒██░▒██  ▀█▄  ▒██░
   ▒██    ▒██ ░██▄▄▄▄██ ▓██▒  ▐▌██▒▓▓█  ░██░░██▄▄▄▄██ ▒██░
   ▒██▒   ░██▒ ▓█   ▓██▒▒██░   ▓██░▒▒█████▓  ▓█   ▓██▒░██████▒
   ░ ▒░   ░  ░ ▒▒   ▓▒█░░ ▒░   ▒ ▒ ░▒▓▒ ▒ ▒  ▒▒   ▓▒█░░ ▒░▓  ░
   ░  ░      ░  ▒   ▒▒ ░░ ░░   ░ ▒░░░▒░ ░ ░   ▒   ▒▒ ░░ ░ ▒  ░
   ░      ░     ░   ▒      ░   ░ ░  ░░░ ░ ░   ░   ▒     ░ ░
          ░         ░  ░         ░    ░           ░  ░    ░  ░
\`\`\`
`.trim();

export const collectDmgMarkdown = async (): Promise<string> => {
	const body = await collectDungeonMasterGuideMarkdown({ includeOperatorSections: true });

	return normalizeLineEndings(`${DMG_ASCII_HEADER}\n\n${body}`);
};

export const collectInGameDmgMarkdown = async (): Promise<string> =>
	normalizeLineEndings(await collectDungeonMasterGuideMarkdown({ includeOperatorSections: false }));

export const collectCardsMarkdown = async (): Promise<string> => {
	const body = await collectSections(generateCardCatalogue);

	return normalizeLineEndings(`${CARDS_ASCII_HEADER}\n\n${body}`);
};

export const collectMonstersMarkdown = async (): Promise<string> => {
	const monsterList = allMonsters.map((Monster: { creatureType?: string }) => Monster.creatureType ?? '').join('\n');
	const entries = allMonsters.map((Monster: new () => object) => buildMonsterEntry(Monster, 0)).join('\n\n');

	return normalizeLineEndings(`${MONSTERS_ASCII_HEADER}

There are ${allMonsters.length} different types of monsters:

${monsterList}

Stat ranges by monster type (spawn, level 0):
${entries}
`);
};

export { collectPlayerHandbookMarkdown };

export const collectCardsHtml = async (): Promise<string> =>
	normalizeLineEndings(await collectSections(generateCardCatalogueHtml));

export type RootArtifactName = 'DMG' | 'CARDS' | 'MONSTERS' | 'PLAYER_HANDBOOK' | 'cardsHtml';

export const collectAllRootArtifacts = async (): Promise<Record<RootArtifactName, string>> => ({
	DMG: await collectDmgMarkdown(),
	CARDS: await collectCardsMarkdown(),
	MONSTERS: await collectMonstersMarkdown(),
	PLAYER_HANDBOOK: normalizeLineEndings(collectPlayerHandbookMarkdown()),
	cardsHtml: await collectCardsHtml(),
});

export type WriteFileFn = (basename: string, content: string, suffix?: string) => void;

export const generateRootDocs = async (writeFile: WriteFileFn): Promise<void> => {
	const artifacts = await collectAllRootArtifacts();

	writeFile('DMG', artifacts.DMG);
	writeFile('CARDS', artifacts.CARDS);
	writeFile('MONSTERS', artifacts.MONSTERS);
	writeFile('PLAYER_HANDBOOK', artifacts.PLAYER_HANDBOOK);
	writeFile('cards', artifacts.cardsHtml, 'html');
};

export const generateRootDocsToDisk = async (rootDir = '.'): Promise<void> => {
	const writeFile: WriteFileFn = (basename, content, suffix = 'md') => {
		writeFileSync(`${rootDir}/${basename}.${suffix}`, normalizeLineEndings(content), 'utf8');
	};

	await generateRootDocs(writeFile);
};

export default generateRootDocs;
