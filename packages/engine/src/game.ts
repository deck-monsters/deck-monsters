import zlib from 'node:zlib';

import { find, reduce } from './helpers/collection.js';
import { all as cardTypes, draw } from './cards/index.js';
import { all as itemTypes } from './items/index.js';
import { allMonsters as monsterTypes } from './monsters/index.js';
import { COINS_PER_VICTORY, COINS_PER_DEFEAT } from './constants/coins.js';
import { createCharacter } from './characters/index.js';
import { globalSemaphore } from './helpers/semaphore.js';
import { listen, loadHandlers } from './commands/index.js';
import { sortByXP } from './helpers/sort.js';
import { XP_PER_VICTORY, XP_PER_DEFEAT } from './helpers/experience.js';
import { initialize as initializeAnnouncements } from './announcements/index.js';
import { save as awsSave } from './helpers/aws.js';
import { BaseClass } from './shared/baseClass.js';
import cardOdds from './card-odds.json' with { type: 'json' };
import { ChannelManager } from './channel/index.js';
import { dungeonMasterGuide } from './build/dungeon-master-guide.js';
import { Exploration } from './exploration/index.js';
import { monsterManual } from './build/monster-manual.js';
import { playerHandbook } from './build/player-handbook.js';
import { Ring } from './ring/index.js';
import type { ChannelCallback } from './channel/index.js';

const PUBLIC_CHANNEL = 'PUBLIC_CHANNEL';

export class Game extends BaseClass {
	static eventPrefix = 'game';

	log: (err: unknown) => void;
	key: string;
	channelManager: ChannelManager;
	publicChannel: (opts: { announce: string }) => Promise<unknown>;
	ring: Ring;
	exploration: Exploration;
	stateSaveFunc?: (state: string) => void;

	constructor(
		publicChannelFn: ChannelCallback,
		options: Record<string, unknown> = {},
		log: (err: unknown) => void = () => {}
	) {
		super(options, globalSemaphore);

		this.log = log;
		this.key = `DeckMonsters.Backup.${Date.now()}`;
		this.channelManager = new ChannelManager({}, this.log);
		this.channelManager.addChannel({
			channel: publicChannelFn,
			channelName: PUBLIC_CHANNEL,
		});
		this.publicChannel = ({ announce }) =>
			this.channelManager.queueMessage({ announce, channelName: PUBLIC_CHANNEL });
		this.ring = new Ring(
			this.channelManager,
			{ spawnBosses: (this.options as any).spawnBosses },
			this.log
		);
		this.exploration = new Exploration(this.channelManager, {}, this.log);

		this.initializeEvents();
		loadHandlers();

		this.on('stateChange', () => this.saveState());

		this.emit('initialized');
	}

	reset(options: Record<string, unknown>): void {
		this.optionsStore = {};
		this.setOptions(options as any);
	}

	get characters(): Record<string, any> {
		if ((this.options as any).characters === undefined) {
			this.characters = {};
		}

		return (this.options as any).characters || {};
	}

	set characters(characters: Record<string, any>) {
		this.setOptions({ characters } as any);
	}

	get saveState(): () => void {
		return () => {
			const buffer = zlib.gzipSync(JSON.stringify(this));

			if (this.stateSaveFunc) {
				const string = buffer.toString('base64');
				setImmediate(this.stateSaveFunc, string);
			}

			setImmediate(awsSave, this.key, buffer, this.log);
		};
	}

	set saveState(stateSaveFunc: ((state: string) => void) | undefined) {
		if (stateSaveFunc) {
			this.stateSaveFunc = stateSaveFunc;
		} else {
			delete this.stateSaveFunc;
		}
	}

	initializeEvents(): void {
		initializeAnnouncements(this);

		this.on('creature.win', this.handleWinner.bind(this));
		this.on('creature.loss', this.handleLoser.bind(this));
		this.on('creature.permaDeath', this.handlePermaDeath.bind(this));
		this.on('creature.fled', this.handleFled.bind(this));
	}

	handleCommand({ command, game = this }: { command: string; game?: Game }): any {
		return listen({ command, game });
	}

	handleWinner(className: string, monster: any, { contestant }: { contestant: any }): void {
		contestant.character.xp += XP_PER_VICTORY;
		contestant.character.coins += COINS_PER_VICTORY;

		const card = this.drawCard({}, monster);
		contestant.character.addCard(card);

		this.emit('cardDrop', { contestant, card });

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_VICTORY,
			coinsGained: COINS_PER_VICTORY,
		});
	}

	handlePermaDeath(className: string, monster: any, { contestant }: { contestant: any }): void {
		contestant.character.xp += XP_PER_DEFEAT * 2;
		contestant.character.coins += COINS_PER_DEFEAT * 2;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT * 2,
			coinsGained: COINS_PER_DEFEAT * 2,
		});
	}

	handleLoser(className: string, monster: any, { contestant }: { contestant: any }): void {
		contestant.character.xp += XP_PER_DEFEAT;
		contestant.character.coins += COINS_PER_DEFEAT;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT,
			coinsGained: COINS_PER_DEFEAT,
		});
	}

	handleFled(className: string, monster: any, { contestant }: { contestant: any }): void {
		monster.xp += XP_PER_DEFEAT;
		contestant.character.xp += XP_PER_DEFEAT;
		contestant.character.coins += COINS_PER_DEFEAT;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT,
			coinsGained: COINS_PER_DEFEAT,
		});

		this.emit('gainedXP', {
			contestant,
			creature: monster,
			xpGained: XP_PER_DEFEAT,
		});
	}

	clearRing(): void {
		this.ring.clearRing();
	}

	getCharacter({
		channel,
		gender,
		icon,
		id,
		name,
		type,
	}: {
		channel: any;
		gender?: string;
		icon?: string;
		id: string;
		name: string;
		type?: string;
	}): Promise<any> {
		const game = this;

		return Promise.resolve(this.characters[id]).then(existingCharacter => {
			if (!existingCharacter) {
				return createCharacter(channel, {
					name,
					type,
					gender,
					icon,
					game,
				}).then((character: any) => {
					game.characters[id] = character;

					game.emit('characterCreated', { character });

					return character;
				});
			}

			return existingCharacter;
		});
	}

	static getCardTypes(): Record<string, any> {
		return (cardTypes as any[]).reduce((obj: Record<string, any>, Card: any) => {
			obj[Card.cardType.toLowerCase()] = Card;
			return obj;
		}, {});
	}

	static getItemTypes(): Record<string, any> {
		return (itemTypes as any[]).reduce((obj: Record<string, any>, Item: any) => {
			obj[Item.itemType.toLowerCase()] = Item;
			return obj;
		}, {});
	}

	static getMonsterTypes(): Record<string, any> {
		return (monsterTypes as any[]).reduce((obj: Record<string, any>, Monster: any) => {
			obj[Monster.monsterType.toLowerCase()] = Monster;
			return obj;
		}, {});
	}

	getAllMonstersLookup(): Record<string, any> {
		return reduce(
			this.characters,
			(all: Record<string, any>, character: any) => {
				character.monsters.forEach((monster: any) => {
					all[monster.givenName.toLowerCase()] = monster;
				});

				return all;
			},
			{}
		);
	}

	findCharacterByName(name: string): any {
		return find(
			this.characters,
			(character: any) => character.givenName.toLowerCase() === name.toLowerCase()
		);
	}

	lookAtCharacter(channel: any, characterName: string, self: any): Promise<unknown> {
		if (characterName) {
			const character = this.findCharacterByName(characterName);
			const isSelf = character === self;

			if (character) return character.look(channel, isSelf);
		}

		return Promise.reject(
			channel({
				announce: `I can find no character by the name of ${characterName}.`,
				delay: 'short',
			})
		);
	}

	getCreatureRankings(creatures: any[], top = 5): string[] {
		const sortedCreatures = sortByXP(creatures).reverse();
		sortedCreatures.length = Math.min(sortedCreatures.length, top);

		const maxLength = sortedCreatures.reduce(
			(length: number, creature: any) => Math.max(creature.givenName.length, length),
			0
		);
		const padding = ' '.repeat(maxLength);

		return sortedCreatures.map((creature: any) => {
			const paddedName = `${creature.givenName}${padding}`.slice(0, maxLength);

			return `${paddedName}   ${creature.xp}`;
		});
	}

	lookAtCharacterRankings(channel: any): Promise<unknown> {
		const results = this.getCreatureRankings(Object.values(this.characters));

		return Promise.resolve(
			channel({
				announce: `*Top ${results.length} Players by XP:*\n\n\`\`\`\n${results.join('\n')}\n\`\`\`\n`,
				delay: 'short',
			})
		);
	}

	lookAtMonsterRankings(channel: any): Promise<unknown> {
		const results = this.getCreatureRankings(Object.values(this.getAllMonstersLookup()));

		return Promise.resolve(
			channel({
				announce: `*Top ${results.length} Monsters by XP:*\n\n\`\`\`\n${results.join('\n')}\n\`\`\`\n`,
				delay: 'short',
			})
		);
	}

	editSelfCharacter(channel: any, character: any): Promise<unknown> {
		if (character) return character.editSelf(channel);
		return Promise.reject(channel({ announce: 'Could not find your character.', delay: 'short' }));
	}

	editCharacter(channel: any, characterName: string): Promise<unknown> {
		if (characterName) {
			const character = this.findCharacterByName(characterName);

			if (character) return character.edit(channel);
		}

		return Promise.reject(
			channel({
				announce: `I can find no character by the name of ${characterName}.`,
				delay: 'short',
			})
		);
	}

	lookAtMonster(channel: any, monsterName: string, character: any): Promise<unknown> {
		if (monsterName) {
			const allMonsters = this.getAllMonstersLookup();
			const monster = allMonsters[monsterName.toLowerCase()];
			const ownsMonster = character.ownsMonster(monsterName);

			if (monster) return monster.look(channel, ownsMonster);
		}

		return Promise.reject(
			channel({
				announce: `I can find no monster by the name of ${monsterName}.`,
				delay: 'short',
			})
		);
	}

	editMonster(channel: any, monsterName: string): Promise<unknown> {
		if (monsterName) {
			const allMonsters = this.getAllMonstersLookup();
			const monster = allMonsters[monsterName.toLowerCase()];

			if (monster) return monster.edit(channel);
		}

		return Promise.reject(
			channel({
				announce: `I can find no monster by the name of ${monsterName}.`,
				delay: 'short',
			})
		);
	}

	lookAtCard(channel: any, cardName: string): Promise<unknown> {
		if (cardName) {
			const cards = (this.constructor as typeof Game).getCardTypes();
			const Card = cards[cardName.toLowerCase()];

			if (Card) {
				const card = new Card();
				return card.look(channel, true);
			}
		}

		return Promise.reject(
			channel({
				announce: `Sorry, we don't carry ${cardName} cards here.`,
				delay: 'short',
			})
		);
	}

	lookAtItem(channel: any, itemName: string): Promise<unknown> {
		if (itemName) {
			const items = (this.constructor as typeof Game).getItemTypes();
			const Item = items[itemName.toLowerCase()];

			if (Item) {
				const item = new Item();
				return item.look(channel, true);
			}
		}

		return Promise.reject(
			channel({
				announce: `Sorry, we don't carry ${itemName} here.`,
				delay: 'short',
			})
		);
	}

	getCardProbabilities(): unknown {
		return cardOdds;
	}

	getRing(): Ring {
		return this.ring;
	}

	getExploration(): Exploration {
		return this.exploration;
	}

	lookAtRing(
		channel: any,
		_ringName = 'main',
		showCharacters?: boolean,
		summary?: boolean
	): Promise<void> {
		return this.getRing().look(channel, showCharacters, summary);
	}

	lookAtRingCards(channel: any, _ringName = 'main'): Promise<void> {
		return this.getRing().lookAtCards(channel);
	}

	lookAt(channel: any, thing: string): Promise<unknown> {
		if (thing) {
			if (thing.match(/(?:dungeon master(?:s)?|dm) guide|dmg/i)) {
				return dungeonMasterGuide({ channel });
			}

			if (thing.match(/monster(?:s)? manual/i)) {
				return monsterManual({ channel });
			}

			if (thing.match(/player(?:s)? handbook/i)) {
				return playerHandbook(channel);
			}

			const monsters = this.getAllMonstersLookup();
			const monster = monsters[thing];

			if (monster) return monster.look(channel);

			const cards = (this.constructor as typeof Game).getCardTypes();
			const Card = cards[thing];

			if (Card) {
				const card = new Card();
				return card.look(channel);
			}

			const items = (this.constructor as typeof Game).getItemTypes();
			const Item = items[thing];

			if (Item) {
				const item = new Item();
				return item.look(channel);
			}
		}

		return Promise.reject(
			channel({ announce: `I don't see a ${thing} here.`, delay: 'short' })
		);
	}

	drawCard(options: Record<string, unknown>, monster?: any): any {
		const card = draw(options, monster);

		this.emit('cardDrawn', { card });

		return card;
	}
}

export default Game;
