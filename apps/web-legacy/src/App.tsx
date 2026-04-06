import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth-context.js';
import AppLayout from './components/AppLayout.js';
import LoginView from './views/LoginView.js';
import RoomLobbyView from './views/RoomLobbyView.js';
import RingFeedView from './views/RingFeedView.js';
import MonstersView from './views/MonstersView.js';
import DeckBuilderView from './views/DeckBuilderView.js';
import ShopView from './views/ShopView.js';
import SpawnView from './views/SpawnView.js';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="empty-state">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { session } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/" replace /> : <LoginView />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/rooms" replace />} />
        <Route path="rooms" element={<RoomLobbyView />} />
        <Route path="ring/:roomId" element={<RingFeedView />} />
        <Route path="monsters/:roomId" element={<MonstersView />} />
        <Route path="deck/:roomId/:monsterName" element={<DeckBuilderView />} />
        <Route path="shop/:roomId" element={<ShopView />} />
        <Route path="spawn/:roomId" element={<SpawnView />} />
      </Route>
    </Routes>
  );
}
