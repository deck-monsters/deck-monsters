import { expect } from 'chai';
import sinon from 'sinon';

import { randomContestant } from '../helpers/bosses.js';
import Game from '../game.js';
import { PROMPT_CANCELLED } from '../events/room-event-bus.js';

/*
 * Roadmap 10 J: a reset or a cross-process drop disposes the game. Before this, a fight in
 * progress kept playing on its own timer chain, a command waiting on a question waited for
 * its 120 s timeout, and the old game could still save over the room that replaced it.
 */
describe('disposing a game mid-fight (roadmap 10 J)', () => {
	afterEach(() => sinon.restore());

	it('stops the fight: no further card, and no fight conclusion', async () => {
		const game = new Game();
		const ring = game.getRing();
		const attacker = randomContestant({ isBoss: false });
		const target = randomContestant({ isBoss: false });
		const played: string[] = [];
		attacker.monster.cards = [
			{ name: 'Reset', play: async () => { played.push('reset'); game.dispose(); return true; } },
		];
		target.monster.cards = [{ name: 'After', play: async () => { played.push('after'); return true; } }];
		ring.contestants = [attacker, target];
		let concluded = false;
		ring.on('fightConcludes', () => { concluded = true; });

		void ring.fight();
		await new Promise(resolve => setTimeout(resolve, 50));

		expect(played).to.deep.equal(['reset']);
		expect(concluded).to.equal(false);
	});

	it('stops even when the reset lands during the fight\'s final, killing card', async () => {
		const game = new Game();
		const ring = game.getRing();
		const attacker = randomContestant({ isBoss: false });
		const target = randomContestant({ isBoss: false });
		attacker.monster.cards = [{
			name: 'Reset and kill',
			play: async (_player: unknown, victim: { hp: number; dead?: boolean }) => {
				game.dispose();
				victim.hp = 0;
				(victim as any).dead = true;
				return true;
			},
		}];
		target.monster.cards = [{ name: 'Wait', play: async () => true }];
		ring.contestants = [attacker, target];
		let concluded = false;
		ring.on('fightConcludes', () => { concluded = true; });

		void ring.fight();
		await new Promise(resolve => setTimeout(resolve, 50));

		expect(concluded).to.equal(false);
	});

	it('answers a question asked after dispose at once', async () => {
		const game = new Game();
		game.dispose();
		expect(await game.eventBus.sendPrompt('user-1', 'Which?', ['A'])).to.equal(PROMPT_CANCELLED);
	});

	it('cancels every open prompt, so a waiting command unwinds', async () => {
		const game = new Game();
		const answer = game.eventBus.sendPrompt('user-1', 'Which monster?', ['A', 'B']);

		game.dispose();

		expect(await answer).to.equal(PROMPT_CANCELLED);
	});

	it('never saves once disposed', () => {
		const clock = sinon.useFakeTimers();
		const save = sinon.spy();
		const game = new Game();
		game.stateSaveFunc = save;

		game.dispose();
		(game as any).scheduleSave();
		clock.tick(60_000);

		expect(save.called).to.equal(false);
	});
});
