import { BaseClass } from '../shared/baseClass.js';
import { random, shuffle } from '../helpers/random.js';
import { actionCard, monsterCard } from '../helpers/card.js';
import { calculateXP } from '../helpers/experience.js';
import { getTarget } from '../helpers/targeting-strategies.js';
import { randomContestant } from '../helpers/bosses.js';
import { sortCardsAlphabetically } from '../cards/helpers/sort.js';
import { shortDelay } from '../helpers/delay-times.js';
import { uniqueCards } from '../cards/helpers/unique-cards.js';
import { eachSeries } from '../helpers/promise.js';
import type { ChannelManager, ChannelCallback } from '../channel/index.js';

const MAX_BOSSES = 5;
const MAX_MONSTERS = 12;
const MIN_MONSTERS = 2;
const FIGHT_DELAY = 60000;

export interface Contestant {
	monster: any;
	character: any;
	channel: ChannelCallback;
	channelName: string;
	isBoss?: boolean;
	won?: boolean;
	lost?: boolean;
	fled?: boolean;
	killed?: any;
	killedBy?: any;
	rounds?: number;
	encounter?: any;
	round?: number;
}

export class Ring extends BaseClass {
	static eventPrefix = 'ring';

	log: (err: unknown) => void;
	spawnBosses: boolean;
	channelManager: ChannelManager;
	battles: any[];
	inEncounter: boolean = false;
	encounter?: Record<string, any>;
	fightTimer?: ReturnType<typeof setTimeout>;

	constructor(
		channelManager: ChannelManager,
		{ spawnBosses = true, ...options }: Record<string, any> = {},
		log: (err: unknown) => void = () => {}
	) {
		super(options);

		this.log = log;
		this.spawnBosses = spawnBosses;
		this.channelManager = channelManager;
		this.battles = [];

		this.on('fightConcludes', (_className: string, ring: Ring, results: any) => {
			ring.battles.push(results);
		});

		this.channelManager.on('win', (_className: string, _channel: any, { contestant }: { contestant: Contestant }) =>
			this.handleWinner({ contestant })
		);
		this.channelManager.on('loss', (_className: string, _channel: any, { contestant }: { contestant: Contestant }) =>
			this.handleLoser({ contestant })
		);
		this.channelManager.on('permaDeath', (_className: string, _channel: any, { contestant }: { contestant: Contestant }) =>
			this.handlePermaDeath({ contestant })
		);
		this.channelManager.on('draw', (_className: string, _channel: any, { contestant }: { contestant: Contestant }) =>
			this.handleTied({ contestant })
		);
		this.channelManager.on('fled', (_className: string, _channel: any, { contestant }: { contestant: Contestant }) =>
			this.handleFled({ contestant })
		);

		this.startBossTimer();
	}

	get contestants(): Contestant[] {
		return (this.options as any).contestants || [];
	}

	set contestants(contestants: Contestant[]) {
		this.setOptions({ contestants } as any);
	}

	get encounterEffects(): any[] {
		return (this.encounter || {}).effects || [];
	}

	set encounterEffects(effects: any[]) {
		this.encounter = {
			...this.encounter,
			effects,
		};
	}

	getMonsters(targetCharacter?: any): any[] {
		let targetContestants = this.contestants;
		if (targetCharacter) {
			targetContestants = targetContestants.filter(
				contestant => contestant.character === targetCharacter
			);
		}

		return targetContestants.map(contestant => contestant.monster);
	}

	removeMonster({
		monster,
		character,
		channel,
		channelName,
	}: {
		monster: any;
		character: any;
		channel: ChannelCallback;
		channelName: string;
	}): Promise<void> {
		return Promise.resolve()
			.then(() => {
				if (this.inEncounter) {
					return Promise.reject(
						channel({ announce: 'You cannot withdraw while an encounter is in progress' })
					);
				}

				if (this.contestants.length <= 0) {
					return Promise.reject(channel({ announce: 'No monsters currently in ring' }));
				}

				if (!monster || !monster.givenName) {
					return Promise.reject(
						channel({ announce: 'No monster specified to remove from ring' })
					);
				}

				const contestant = this.findContestant(character, monster);
				if (!contestant) {
					return Promise.reject(
						channel({ announce: 'Your monster is not currently in the ring' })
					);
				}

				return contestant;
			})
			.then((contestant: Contestant) => {
				const contestantIndex = this.contestants.indexOf(contestant);

				this.contestants.splice(contestantIndex, 1);

				if (this.contestants.length < 1) {
					this.clearRing();
				}

				this.emit('remove', { contestant });

				this.channelManager.queueMessage({
					announce: `${monster.givenName} has returned to nestle safely into your warm embrace.`,
					channel,
					channelName,
				});

				this.channelManager.sendMessages().then(() => this.startFightTimer());
			});
	}

	addMonster({
		monster,
		character,
		channel,
		channelName,
		isBoss,
	}: {
		monster: any;
		character: any;
		channel: ChannelCallback;
		channelName: string;
		isBoss?: boolean;
	}): void {
		if (this.contestants.length < MAX_MONSTERS && !this.inEncounter) {
			const contestant: Contestant = {
				monster,
				character,
				channel,
				channelName,
				isBoss,
			};

			this.contestants = shuffle([...this.contestants, contestant]);

			if (this.contestants.length > MAX_MONSTERS) {
				this.clearRing();
			} else {
				this.emit('add', { contestant });

				this.channelManager.queueMessage({
					announce: `${monster.givenName} has entered the ring. May the odds be ever in your favor.`,
					channel,
					channelName,
				});

				this.channelManager.sendMessages().then(() => this.startFightTimer());
			}
		} else {
			this.channelManager.queueMessage({
				announce: 'The ring is full! Wait until the current battle is over and try again.',
				channel,
				channelName,
			});
		}
	}

	monsterIsInRing(monster: any): boolean {
		return !!this.contestants.find(contestant => contestant.monster === monster);
	}

	findContestant(character: any, monster: any): Contestant | undefined {
		return this.contestants.find(
			contestant => contestant.character === character && contestant.monster === monster
		);
	}

	look(channel: any, showCharacters = true, summary = false): Promise<void> {
		const { length } = this.contestants;

		if (length < 1) {
			return Promise.reject(
				channel({ announce: 'The ring is empty.', delay: 'short' })
			);
		}

		const { channelManager, channelName } = channel;

		if (summary) {
			return Promise.resolve()
				.then(() => {
					const monsters = this.contestants.map(
						({ monster }) =>
							`${monster.identity} - ${monster.creatureType} (${monster.displayLevel.replace('level ', '')})`
					);

					return channelManager.queueMessage({
						announce: `###########################################\n${monsters.join('\n')}\n###########################################`,
						channel,
						channelName,
					});
				})
				.then(() => channelManager.sendMessages());
		}

		return Promise.resolve()
			.then(() =>
				channelManager.queueMessage({
					announce: `###########################################\nThere ${length === 1 ? 'is one contestant' : `are ${length} contestants`} in the ring.\n###########################################`,
					channel,
					channelName,
				})
			)
			.then(() =>
				eachSeries(this.contestants, (contestant: Contestant) => {
					let characterDisplay = '';
					if (showCharacters) {
						characterDisplay = `${monsterCard(contestant.character, true)}\nSent the following monster into the ring:\n\n`;
					}

					const monsterDisplay = monsterCard(contestant.monster, !showCharacters);

					return channelManager.queueMessage({
						announce: `${characterDisplay}${monsterDisplay}###########################################`,
						channel,
						channelName,
					});
				})
			)
			.then(() => channelManager.sendMessages());
	}

	lookAtCards(channel: any): Promise<void> {
		const { length } = this.contestants;

		if (length < 1) {
			return Promise.reject(channel({ announce: 'The ring is empty.', delay: 'short' }));
		}

		if (!this.inEncounter) {
			return Promise.reject(
				channel({ announce: 'Wait until the encounter has started.', delay: 'short' })
			);
		}

		const { channelManager, channelName } = channel;
		return Promise.resolve()
			.then(() =>
				channelManager.queueMessage({
					announce: `###########################################\nThe following cards are in play:\n`,
					channel,
					channelName,
				})
			)
			.then(() => {
				const cards = sortCardsAlphabetically(
					uniqueCards(
						this.contestants.reduce((allCards: any[], { monster }: Contestant) => {
							allCards.push(...monster.cards);
							return allCards;
						}, [])
					)
				);

				return eachSeries(cards, (card: any) => {
					const cardDisplay = actionCard(card, true);

					return channelManager.queueMessage({
						announce: cardDisplay,
						channel,
						channelName,
					});
				});
			})
			.then(() =>
				channelManager.queueMessage({
					announce: '###########################################',
					channel,
					channelName,
				})
			)
			.then(() => channelManager.sendMessages());
	}

	startEncounter(): boolean {
		if (this.inEncounter) return false;

		this.inEncounter = true;
		this.encounter = {};
		this.contestants.forEach(({ channel, channelName, monster }) => {
			monster.startEncounter(this);

			this.channelManager.queueMessage({
				announce:
					'The fight has begun! You may now type `look at monsters in the ring` to see all participants with their current stats, and `look at cards in the ring` to see the detailed stats of every card that will be in play.',
				channel,
				channelName,
			});
		});

		return true;
	}

	endEncounter(): void {
		this.contestants.forEach(contestant => contestant.monster.endEncounter());
		this.inEncounter = false;
		delete this.encounter;
	}

	clearRing(): void {
		clearTimeout(this.fightTimer);
		this.endEncounter();
		this.contestants = [];
		this.emit('clear');
	}

	startFightTimer(): void {
		clearTimeout(this.fightTimer);

		const getPlayerContestants = (): {
			contestants: Contestant[];
			numberOfMonstersInRing: number;
		} => {
			let hasBoss = false;
			const playerContestants = this.contestants.filter(contestant => {
				if (contestant.isBoss) {
					hasBoss = true;
					return false;
				}

				return true;
			});

			return {
				contestants: playerContestants,
				numberOfMonstersInRing: playerContestants.length + (hasBoss ? 1 : 0),
			};
		};

		const { contestants, numberOfMonstersInRing } = getPlayerContestants();

		if (numberOfMonstersInRing >= MIN_MONSTERS) {
			contestants.forEach(({ channel, channelName }) =>
				this.channelManager.queueMessage({
					announce: `Fight will begin in ${Math.floor(FIGHT_DELAY / 1000)} seconds.`,
					channel,
					channelName,
				})
			);

			this.fightTimer = setTimeout(() => {
				const { numberOfMonstersInRing: numberOfMonstersStillInRing } =
					getPlayerContestants();

				if (numberOfMonstersStillInRing >= MIN_MONSTERS) {
					this.channelManager.sendMessages().then(() => this.fight());
				}
			}, FIGHT_DELAY);
		} else if (numberOfMonstersInRing <= 0) {
			this.emit('narration', {
				narration: 'The ring is quiet save for the faint sound of footsteps fleeing into the distance.',
			});
		} else {
			const needed = MIN_MONSTERS - numberOfMonstersInRing;
			const monster = needed > 1 ? 'monsters' : 'monster';
			const join = needed > 1 ? 'join' : 'joins';

			contestants.forEach(({ channel, channelName }) =>
				this.channelManager.queueMessage({
					announce: `Fight countdown will begin once ${needed} more ${monster} ${join} the ring.`,
					channel,
					channelName,
				})
			);
		}
	}

	fight(): Promise<void> {
		const ring = this;
		const fightLog: string[] = [];

		if (!this.startEncounter()) return Promise.resolve();

		const contestants = [...this.contestants];
		const isActiveContestant = (contestant: Contestant | undefined): boolean =>
			!!(contestant && !contestant.monster.dead && !contestant.monster.fled);
		const getActiveContestants = (currentContestants: Contestant[]): Contestant[] =>
			currentContestants.filter(isActiveContestant);
		const getAllActiveContestants = (): Contestant[] => getActiveContestants(contestants);
		const getContestantsWithCardsLeft = (currentContestants: Contestant[]): Contestant[] =>
			currentContestants.filter(contestant => contestant && !contestant.monster.emptyHanded);
		const anyContestantsHaveCardsLeft = (currentContestants: Contestant[]): boolean =>
			getContestantsWithCardsLeft(currentContestants).length > 0;

		this.emit('fight', { contestants });

		let round = 1;
		let turn: number | undefined;

		const doAction = ({
			currentContestants = contestants,
			cardIndex = 0,
		}: { currentContestants?: Contestant[]; cardIndex?: number } = {}): Promise<
			Contestant | undefined
		> =>
			new Promise((resolve, reject) => {
				let activeContestants = getActiveContestants(currentContestants);
				let nextCardIndex = cardIndex;

				const next = (): void => {
					resolve(doAction({ currentContestants: activeContestants, cardIndex: nextCardIndex }));
				};

				if (activeContestants.length <= 1) {
					nextCardIndex += 1;

					if (activeContestants.length === 1) {
						activeContestants = [...activeContestants, ...getAllActiveContestants()];
					} else {
						activeContestants = getAllActiveContestants();
						next();
						return;
					}
				}

				const playerContestant = activeContestants.shift()!;
				const { monster: player } = playerContestant;
				const card = player.cards[cardIndex];

				if (card) {
					if (turn !== cardIndex) {
						turn = cardIndex;

						this.emit('startTurn', {
							turn,
							contestants: getAllActiveContestants(),
							round,
						});
					}

					this.emit('playerTurnBegin', { contestant: playerContestant, round });

					const targetContestant = getTarget({
						contestants: getAllActiveContestants(),
						playerContestant,
						strategy: playerContestant.monster.targetingStrategy,
					}) as Contestant;
					const { monster: proposedTarget } = targetContestant;

					playerContestant.round = round;

					fightLog.push(
						`${player.givenName}: ${card.name} target ${proposedTarget.givenName}`
					);

					card
						.play(player, proposedTarget, ring, getAllActiveContestants())
						.then(() => {
							if (getAllActiveContestants().length > 1) {
								return this.channelManager.sendMessages().then(() => next());
							}

							return this.channelManager
								.sendMessages()
								.then(() => resolve(playerContestant));
						})
						.catch((ex: unknown) => {
							this.log(ex);
							reject(ex);
						});
				} else {
					this.emit('endOfDeck', { contestant: playerContestant, round });

					player.emptyHanded = true;

					const allActiveContestants = getAllActiveContestants();
					if (!anyContestantsHaveCardsLeft(allActiveContestants)) {
						this.emit('roundComplete', { contestants, round });

						if (round === 10) {
							resolve(undefined);
							return;
						}

						round += 1;

						allActiveContestants.forEach(({ monster }) => {
							monster.emptyHanded = false;
							monster.round = round;
						});

						nextCardIndex = 0;
						activeContestants = allActiveContestants;
					}

					setTimeout(() => next(), shortDelay());
				}
			});

		return doAction()
			.then(lastContestant =>
				this.fightConcludes({ fightLog, lastContestant, rounds: round })
			)
			.catch(() => {
				this.clearRing();
			});
	}

	fightConcludes({
		lastContestant,
		rounds,
	}: {
		fightLog?: string[];
		lastContestant?: Contestant;
		rounds: number;
	}): void {
		const { contestants } = this;

		const deadContestants: Contestant[] = [];
		contestants.forEach(contestant => {
			if (contestant.monster.dead) {
				deadContestants.push(contestant);
			}

			contestant.killed = contestant.monster.killed;
			contestant.killedBy = contestant.monster.killedBy;
			contestant.fled = contestant.monster.fled;
			contestant.rounds = contestant.monster.round;
			contestant.encounter = contestant.monster.endEncounter();
		});
		const deaths = deadContestants.length;

		this.channelManager.queueMessage({
			event: {
				name: 'fightConcludes',
				properties: {
					contestants,
					deadContestants,
					deaths,
					lastContestant,
					rounds,
				},
			},
		});

		contestants.forEach(contestant => {
			const { channel, channelName } = contestant;

			this.awardMonsterXP(contestant, contestants);

			if (deaths > 0) {
				if (contestant.monster.dead) {
					contestant.lost = true;

					if (contestant.monster.destroyed) {
						this.channelManager.queueMessage({
							announce: `${contestant.monster.givenName} was too badly injured to be revived.`,
							channel,
							channelName,
							event: { name: 'permaDeath', properties: { contestant } },
						});
					} else {
						this.channelManager.queueMessage({
							announce: `${contestant.monster.givenName} has died in battle. You may now \`revive\` or \`dismiss\` ${contestant.monster.pronouns.him}.`,
							channel,
							channelName,
							event: { name: 'loss', properties: { contestant } },
						});
					}
				} else if (contestant.fled) {
					this.channelManager.queueMessage({
						announce: `${contestant.monster.givenName} lived to fight another day!`,
						channel,
						channelName,
						event: { name: 'fled', properties: { contestant } },
					});
				} else {
					contestant.won = true;

					this.channelManager.queueMessage({
						announce: `${contestant.monster.identity} is victorious!`,
						channel,
						channelName,
						event: { name: 'win', properties: { contestant } },
					});
				}
			} else {
				this.channelManager.queueMessage({
					announce: 'The fight ended in a draw.',
					channel,
					channelName,
					event: { name: 'draw', properties: { contestant } },
				});
			}
		});

		this.channelManager.sendMessages().then(() => {
			this.emit('fightConcludes', {
				contestants,
				deadContestants,
				deaths,
				isDraw: deaths <= 0,
				lastContestant,
				rounds,
			});

			this.clearRing();
		});
	}

	awardMonsterXP(contestant: Contestant, contestants: Contestant[]): void {
		const { monster, killed } = contestant;
		const { gainedXP, reasons } = calculateXP(contestant as any, contestants as any);

		if (gainedXP > 0) {
			monster.xp += gainedXP;

			this.emit('gainedXP', {
				contestant,
				creature: monster,
				killed,
				xpGained: gainedXP,
				reasons,
			});
		}
	}

	handleWinner({ contestant }: { contestant: Contestant }): void {
		contestant.character.addWin();
		contestant.monster.addWin();
		this.emit('win', { contestant });
		contestant.monster.emit('win', { contestant });
	}

	handleLoser({ contestant }: { contestant: Contestant }): void {
		contestant.character.addLoss();
		contestant.monster.addLoss();
		this.emit('loss', { contestant });
		contestant.monster.emit('loss', { contestant });
	}

	handlePermaDeath({ contestant }: { contestant: Contestant }): void {
		contestant.character.dropMonster(contestant.monster);
		contestant.character.addLoss();
		this.emit('permaDeath', { contestant });
	}

	handleTied({ contestant }: { contestant: Contestant }): void {
		contestant.character.addDraw();
		contestant.monster.addDraw();
		this.emit('draw', { contestant });
		contestant.monster.emit('draw', { contestant });
	}

	handleFled({ contestant }: { contestant: Contestant }): void {
		contestant.character.addDraw();
		contestant.monster.addDraw();
		this.emit('fled', { contestant });
		contestant.monster.emit('fled', { contestant });
	}

	startBossTimer(): void {
		const ring = this;

		if (this.spawnBosses) {
			setTimeout(() => {
				const numberOfBossesInRing = ring.contestants.reduce(
					(total, contestant) => total + (contestant.isBoss ? 1 : 0),
					0
				);
				if (!ring.inEncounter && numberOfBossesInRing < MAX_BOSSES) {
					ring.emit('bossWillSpawn', { delay: 120000 });
				}

				setTimeout(() => {
					ring.spawnBoss();
					ring.startBossTimer();
				}, 120000);
			}, random(2100000, 3480000));
		}
	}

	spawnBoss(): Contestant | undefined {
		const numberOfBossesInRing = this.contestants.reduce(
			(total, contestant) => total + (contestant.isBoss ? 1 : 0),
			0
		);

		if (!this.inEncounter && numberOfBossesInRing < MAX_BOSSES) {
			const contestant = randomContestant();

			this.addMonster(contestant);

			if (random(1)) {
				const ring = this;
				setTimeout(() => {
					ring.removeBoss(contestant);
				}, 600000);
			}

			return contestant;
		}

		return undefined;
	}

	removeBoss(contestant: Contestant): Promise<void> {
		if (!this.inEncounter && this.contestants.length === 1) {
			return this.removeMonster(contestant as any);
		}

		return Promise.resolve();
	}
}

export default Ring;
