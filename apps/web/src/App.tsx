import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './lib/auth-context.js';
import AppShell from './components/AppShell.js';
import Terminal from './components/Terminal.js';
import LoginView from './views/LoginView.js';
import RoomLobbyView from './views/RoomLobbyView.js';
import RoomSettingsView from './views/RoomSettingsView.js';
import AccountView from './views/AccountView.js';
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

function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const { data: room } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );

  if (!roomId) return <Navigate to="/rooms" replace />;

  return (
    <AppShell roomName={room?.name}>
      <Terminal roomId={roomId} />
    </AppShell>
  );
}

function RoomSettingsWrapper() {
  return (
    <AppShell>
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />

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

      {/* Redirect old ring/monster routes to new terminal */}
      <Route path="/ring/:roomId" element={<Navigate to="/room/:roomId" replace />} />
      <Route path="/monsters/:roomId" element={<Navigate to="/room/:roomId" replace />} />

      {/* RequireAuth holds the loading screen while Supabase processes OAuth hash tokens */}
      <Route path="/" element={<RequireAuth><Navigate to="/rooms" replace /></RequireAuth>} />
      <Route path="*" element={<RequireAuth><Navigate to="/rooms" replace /></RequireAuth>} />
    </Routes>
  );
}
