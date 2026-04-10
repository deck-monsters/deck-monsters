import type { Game } from '../game.js';
import { registerPreCharacterHandler, type ActionOptions } from './index.js';

const LEADERBOARD_PLAYERS =
	/^(?:leaderboard|show leaderboard|look at leaderboard|top players)$/i;

const LEADERBOARD_MONSTERS = /^top monsters$/i;

const GLOBAL_LEADERBOARD = /^(?:global leaderboard|look at global rankings)$/i;

const CATCH_UP =
	/^(?:what happened|catch me up|show recent fights|show fight history|look at fight log)$/i;

export default function historyHandlers(): void {
	registerPreCharacterHandler(LEADERBOARD_PLAYERS, (opts: ActionOptions) => {
		const game = opts.game as Game;
		return game.lookAtCharacterRankings(opts.channel);
	});

	registerPreCharacterHandler(LEADERBOARD_MONSTERS, (opts: ActionOptions) => {
		const game = opts.game as Game;
		return game.lookAtMonsterRankings(opts.channel);
	});

	registerPreCharacterHandler(GLOBAL_LEADERBOARD, (opts: ActionOptions) => {
		const game = opts.game as Game;
		return game.lookAtGlobalCharacterRankings(opts.channel);
	});

	registerPreCharacterHandler(CATCH_UP, (opts: ActionOptions) => {
		const game = opts.game as Game;
		return game.catchUpCommand(opts.channel, opts.user.id);
	});
}
