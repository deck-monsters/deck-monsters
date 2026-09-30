import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FightLogPanel from '../components/FightLogPanel.js';
import LeaderboardPanel from '../components/LeaderboardPanel.js';

const query = { data: [], isLoading: false };
const ringState = vi.hoisted(() => ({ inEncounter: false }));

vi.mock('../lib/trpc.js', () => ({
	trpc: {
		game: {
			ringState: { useQuery: vi.fn(() => ({ data: { inEncounter: ringState.inEncounter } })) },
			recentFights: { useQuery: vi.fn(() => query) },
			fight: { useQuery: vi.fn(() => ({ data: undefined, isLoading: false })) },
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
});
