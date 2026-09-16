import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FightLogPanel from '../components/FightLogPanel.js';
import LeaderboardPanel from '../components/LeaderboardPanel.js';

const query = { data: [], isLoading: false };

vi.mock('../lib/trpc.js', () => ({
	trpc: {
		game: {
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
	it('puts Fight Log content inside its own query container and header', () => {
		const { container } = render(
			<FightLogPanel roomId="room-1" headerActions={<button type="button">Host action</button>} />,
		);

		expect(container.querySelector('.surface-panel-host > .fight-log-panel')).not.toBeNull();
		expect(screen.getByRole('heading', { name: 'Fight log' })).toBeTruthy();
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
});
