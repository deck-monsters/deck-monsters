import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './lib/auth-context.js';
import AppShell from './components/AppShell.js';
import Terminal from './components/Terminal.js';
import LoginView from './views/LoginView.js';
import ResetPasswordView from './views/ResetPasswordView.js';
import RoomLobbyView from './views/RoomLobbyView.js';
import RoomSettingsView from './views/RoomSettingsView.js';
import AccountView from './views/AccountView.js';
import LeaderboardView from './views/LeaderboardView.js';
import FightLogView from './views/FightLogView.js';
import WorkshopView from './views/WorkshopView.js';
import { trpc } from './lib/trpc.js';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-fg-dim)',
        fontFamily: 'var(--font-family)',
        letterSpacing: '0.05em',
      }}
    >
      loading…
    </div>
  );
}

function RedirectWithParam({ base }: { base: string }) {
  const { roomId } = useParams<{ roomId: string }>();
  return <Navigate to={`${base}/${roomId ?? ''}`} replace />;
}

function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const { data: room } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );

  if (!roomId) return <Navigate to="/rooms" replace />;

  return (
    <AppShell roomName={room?.name} roomId={roomId}>
      <Terminal roomId={roomId} />
    </AppShell>
  );
}

function RoomSettingsWrapper() {
  const { roomId } = useParams<{ roomId: string }>();
  const { data: room } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );

  return (
    <AppShell roomName={room?.name} roomId={roomId}>
      <RoomSettingsView />
    </AppShell>
  );
}

function LobbyWrapper() {
  return (
    <AppShell>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <RoomLobbyView />
      </div>
    </AppShell>
  );
}

function AccountWrapper() {
  return (
    <AppShell>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <AccountView />
      </div>
    </AppShell>
  );
}

function JoinByInvite() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const joinRoom = trpc.room.join.useMutation({
    onSuccess: (data) => {
      void utils.room.list.invalidate();
      navigate(`/room/${data.roomId}`, { replace: true });
    },
    onError: () => {
      // Fall back to lobby with code pre-filled via query param
      navigate(`/rooms?invite=${inviteCode ?? ''}`, { replace: true });
    },
  });

  useEffect(() => {
    if (inviteCode) joinRoom.mutate({ inviteCode: inviteCode.toUpperCase() });
    else navigate('/rooms', { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode]);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-fg-dim)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {joinRoom.isError ? 'Redirecting…' : 'Joining room…'}
    </div>
  );
}

function JoinByInviteWrapper() {
  return (
    <RequireAuth>
      <JoinByInvite />
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route path="/reset-password" element={<ResetPasswordView />} />

      <Route
        path="/rooms"
        element={
          <RequireAuth>
            <LobbyWrapper />
          </RequireAuth>
        }
      />

      <Route
        path="/room/:roomId"
        element={
          <RequireAuth>
            <RoomView />
          </RequireAuth>
        }
      />

      <Route
        path="/room/:roomId/settings"
        element={
          <RequireAuth>
            <RoomSettingsWrapper />
          </RequireAuth>
        }
      />

      <Route
        path="/account"
        element={
          <RequireAuth>
            <AccountWrapper />
          </RequireAuth>
        }
      />

      <Route
        path="/leaderboard"
        element={
          <RequireAuth>
            <LeaderboardView />
          </RequireAuth>
        }
      />

      <Route
        path="/room/:roomId/leaderboard"
        element={
          <RequireAuth>
            <LeaderboardView />
          </RequireAuth>
        }
      />

      <Route
        path="/room/:roomId/fights"
        element={
          <RequireAuth>
            <FightLogView />
          </RequireAuth>
        }
      />

      <Route
        path="/room/:roomId/workshop"
        element={
          <RequireAuth>
            <WorkshopView />
          </RequireAuth>
        }
      />

      <Route path="/join/:inviteCode" element={<JoinByInviteWrapper />} />

      {/* Redirect old ring/monster routes to new terminal */}
      <Route path="/ring/:roomId" element={<RedirectWithParam base="/room" />} />
      <Route path="/monsters/:roomId" element={<RedirectWithParam base="/room" />} />

      {/* RequireAuth holds the loading screen while Supabase processes OAuth hash tokens */}
      <Route path="/" element={<RequireAuth><Navigate to="/rooms" replace /></RequireAuth>} />
      <Route path="*" element={<RequireAuth><Navigate to="/rooms" replace /></RequireAuth>} />
    </Routes>
  );
}
