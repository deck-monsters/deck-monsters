import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FightLogPanel from '../components/FightLogPanel.js';
import LeaderboardPanel from '../components/LeaderboardPanel.js';

const query = { data: [], isLoading: false };
const ringState = vi.hoisted(() => ({ inEncounter: false }));
const invalidate = vi.hoisted(() => ({ fights: vi.fn(), leaderboard: vi.fn() }));
const fightDetail = vi.hoisted(() => ({ result: {} as Record<string, unknown>, refetch: vi.fn() }));
const fightRows = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock('../lib/trpc.js', () => ({
	trpc: {
		useUtils: () => ({
			game: { recentFights: { invalidate: invalidate.fights } },
			leaderboard: { invalidate: invalidate.leaderboard },
		}),
		game: {
			ringState: { useQuery: vi.fn(() => ({ data: { inEncounter: ringState.inEncounter } })) },
			recentFights: { useQuery: vi.fn(() => ({ data: fightRows.rows, isLoading: false })) },
			fight: { useQuery: vi.fn(() => ({ data: undefined, isLoading: false, isError: false, refetch: fightDetail.refetch, ...fightDetail.result })) },
		},
		leaderboard: {
			roomPlayers: { useQuery: vi.fn(() => query) },
			roomMonsters: { useQuery: vi.fn(() => query) },
			globalPlayers: { useQuery: vi.fn(() => query) },
			globalMonsters: { useQuery: vi.fn(() => query) },
		},
	},
}));

describe('layout-agnostic surface panels', () => {
	beforeEach(() => {
		ringState.inEncounter = false;
		fightRows.rows = [];
		fightDetail.result = {};
		fightDetail.refetch.mockClear();
		invalidate.fights.mockClear();
		invalidate.leaderboard.mockClear();
	});

	it('puts Fights content inside its own query container and header', () => {
		const { container } = render(
			<FightLogPanel roomId="room-1" headerActions={<button type="button">Host action</button>} />,
		);

		expect(container.querySelector('.surface-panel-host > .fight-log-panel')).not.toBeNull();
		expect(screen.getByRole('heading', { name: 'Fights' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Host action' })).toBeTruthy();
	});

	it('keeps leaderboard overflow on a labelled, keyboard-focusable table region', () => {
		const { container } = render(
			<LeaderboardPanel roomId="room-1" headerActions={<button type="button">Host action</button>} />,
		);

		expect(container.querySelector('.surface-panel-host > .leaderboard-panel')).not.toBeNull();
		const region = screen.getByRole('region', { name: 'Scrollable room player rankings' });
		expect(region).toHaveAttribute('tabindex', '0');
		expect(region).toContainElement(screen.getByRole('table', { name: 'Room player rankings' }));
	});

	it('names the Leaders panel and its empty state when no fight is on', () => {
		render(<LeaderboardPanel roomId="room-1" />);
		expect(screen.getByRole('heading', { name: 'Leaders' })).toBeTruthy();
		expect(screen.getByText(/No ranked fights in this room yet/)).toBeTruthy();
	});

	it('says no fights yet, and how one starts, when the ring is quiet', () => {
		render(<FightLogPanel roomId="room-1" />);
		expect(
			screen.getByText('No fights yet. A fight starts on its own once two monsters are in the ring.'),
		).toBeTruthy();
	});

	it('says a fight is on, instead of "no fights yet", while one is on the ring', () => {
		ringState.inEncounter = true;
		render(<FightLogPanel roomId="room-1" />);
		expect(screen.getByText('A fight is on in the ring. It shows here when it ends.')).toBeTruthy();
		expect(screen.queryByText(/No fights yet/)).toBeNull();
	});

	it('leaders empty state mentions the fight on the ring', () => {
		ringState.inEncounter = true;
		render(<LeaderboardPanel roomId="room-1" />);
		expect(
			screen.getByText('No ranked fights yet. A fight is on in the ring; rankings update when it ends.'),
		).toBeTruthy();
	});

	it('keeps the list and adds the fight-is-on line above it when fights exist', () => {
		ringState.inEncounter = true;
		fightRows.rows = [{ id: 'f1', fightNumber: 1, endedAt: new Date().toISOString(), participants: [] }];
		const { container } = render(<FightLogPanel roomId="room-1" />);
		expect(screen.getByText('A fight is on in the ring. It shows here when it ends.')).toBeTruthy();
		expect(container.querySelectorAll('.fight-log-card')).toHaveLength(1);
	});

	it('refetches fights and rankings once when the fight on the ring ends', () => {
		ringState.inEncounter = true;
		const fights = render(<FightLogPanel roomId="room-1" />);
		const board = render(<LeaderboardPanel roomId="room-1" />);
		expect(invalidate.fights).not.toHaveBeenCalled();
		ringState.inEncounter = false;
		fights.rerender(<FightLogPanel roomId="room-1" />);
		board.rerender(<LeaderboardPanel roomId="room-1" />);
		expect(invalidate.fights).toHaveBeenCalledTimes(1);
		expect(invalidate.fights).toHaveBeenCalledWith({ roomId: 'room-1' });
		expect(invalidate.leaderboard).toHaveBeenCalledTimes(1);
		fights.rerender(<FightLogPanel roomId="room-1" />);
		expect(invalidate.fights).toHaveBeenCalledTimes(1);
	});

	describe('opening a fight row', () => {
		function openRow() {
			fightRows.rows = [{ id: 'f1', fightNumber: 1, endedAt: new Date().toISOString(), participants: [] }];
			render(<FightLogPanel roomId="room-1" />);
			fireEvent.click(screen.getByTitle("Show or hide this fight's play-by-play"));
		}

		it('says it is loading', () => {
			openRow();
			expect(screen.getByText('Loading the play-by-play…')).toBeTruthy();
		});

		it('offers a retry when the fight fails to load', () => {
			fightDetail.result = { isError: true };
			openRow();
			fireEvent.click(screen.getByText("Couldn't load this fight. Tap to try again."));
			expect(fightDetail.refetch).toHaveBeenCalledTimes(1);
		});

		it('shows loading again while a retry is fetching', () => {
			fightDetail.result = { isError: true, isFetching: true };
			openRow();
			expect(screen.getByText('Loading the play-by-play…')).toBeTruthy();
		});

		it('does not offer a retry for a fight that no longer exists', () => {
			fightDetail.result = { isError: true, error: { data: { code: 'NOT_FOUND' } } };
			openRow();
			expect(screen.getByText('Nothing was saved for this fight.')).toBeTruthy();
			expect(screen.queryByText(/Tap to try again/)).toBeNull();
		});

		it('says nothing was saved when there are no events', () => {
			fightDetail.result = { data: { events: [] } };
			openRow();
			expect(screen.getByText('Nothing was saved for this fight.')).toBeTruthy();
		});

		it('lists the events when there are some', () => {
			fightDetail.result = { data: { events: [{ id: 'e1', type: 'narration', text: 'Rex hits.' }] } };
			openRow();
			expect(screen.getByText(/Rex hits\./)).toBeTruthy();
		});
	});
});
