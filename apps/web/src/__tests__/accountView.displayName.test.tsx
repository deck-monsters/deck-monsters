import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const trpcMock = vi.hoisted(() => {
	const mutation = vi.fn();
	const profileInvalidate = vi.fn();
	const roomMembersInvalidate = vi.fn();
	const leaderboardInvalidates = {
		roomPlayers: vi.fn(),
		roomMonsters: vi.fn(),
		globalPlayers: vi.fn(),
		globalMonsters: vi.fn(),
	};

	return {
		profile: { displayName: 'Ada Lovelace' },
		mutation,
		profileInvalidate,
		roomMembersInvalidate,
		leaderboardInvalidates,
		mutationOptions: null as {
			onSuccess?: (result: { displayName: string; renamedCharacters: number }) => void;
			onError?: (error: Error) => void;
		} | null,
	};
});

vi.mock('../lib/trpc.js', () => ({
	trpc: {
		useUtils: () => ({
			profile: { me: { invalidate: trpcMock.profileInvalidate } },
			room: { members: { invalidate: trpcMock.roomMembersInvalidate } },
			leaderboard: {
				roomPlayers: { invalidate: trpcMock.leaderboardInvalidates.roomPlayers },
				roomMonsters: { invalidate: trpcMock.leaderboardInvalidates.roomMonsters },
				globalPlayers: { invalidate: trpcMock.leaderboardInvalidates.globalPlayers },
				globalMonsters: { invalidate: trpcMock.leaderboardInvalidates.globalMonsters },
			},
		}),
		profile: {
			me: { useQuery: () => ({ data: trpcMock.profile }) },
			updateDisplayName: {
				useMutation: (options: typeof trpcMock.mutationOptions) => {
					trpcMock.mutationOptions = options;
					return { mutate: trpcMock.mutation, isPending: false };
				},
			},
		},
	},
}));

vi.mock('../lib/auth-context.js', () => ({
	useAuth: () => ({
		user: { email: 'ada@example.com', app_metadata: {}, user_metadata: {} },
		signOut: vi.fn(),
	}),
}));

vi.mock('../hooks/useTheme.js', () => ({
	useTheme: () => ({
		theme: 'phosphor',
		setTheme: vi.fn(),
		validThemes: ['phosphor'],
	}),
}));

vi.mock('../hooks/useRingKeyTimestamps.js', () => ({
	useRingKeyTimestamps: () => ({
		ringKeyTimestampsEnabled: false,
		setRingKeyTimestampsEnabled: vi.fn(),
	}),
}));

import AccountView from '../views/AccountView.js';

function renderView() {
	return render(
		<MemoryRouter>
			<AccountView />
		</MemoryRouter>,
	);
}

describe('AccountView global display name', () => {
	it('renders the current global display name', () => {
		renderView();

		expect(screen.getByLabelText('Display name')).toHaveValue('Ada Lovelace');
	});

	it('submits the trimmed display name', async () => {
		const user = userEvent.setup();
		renderView();

		await user.clear(screen.getByLabelText('Display name'));
		await user.type(screen.getByLabelText('Display name'), '  Grace Hopper  ');
		await user.click(screen.getByRole('button', { name: 'Save' }));

		expect(trpcMock.mutation).toHaveBeenCalledWith({ displayName: 'Grace Hopper' });
	});

	it('shows a server error inline', () => {
		renderView();

		act(() => {
			trpcMock.mutationOptions?.onError?.(new Error("Display names can't look like an email address."));
		});

		expect(screen.getByRole('alert')).toHaveTextContent("Display names can't look like an email address.");
	});

	it('shows how many room characters were renamed and invalidates dependent data', () => {
		renderView();

		act(() => {
			trpcMock.mutationOptions?.onSuccess?.({ displayName: 'Grace Hopper', renamedCharacters: 2 });
		});

		expect(screen.getByText('Saved — 2 room character(s) renamed to match.')).toBeInTheDocument();
		expect(trpcMock.profileInvalidate).toHaveBeenCalledOnce();
		expect(trpcMock.roomMembersInvalidate).toHaveBeenCalledOnce();
		expect(trpcMock.leaderboardInvalidates.roomPlayers).toHaveBeenCalledOnce();
		expect(trpcMock.leaderboardInvalidates.roomMonsters).toHaveBeenCalledOnce();
		expect(trpcMock.leaderboardInvalidates.globalPlayers).toHaveBeenCalledOnce();
		expect(trpcMock.leaderboardInvalidates.globalMonsters).toHaveBeenCalledOnce();
	});
});
