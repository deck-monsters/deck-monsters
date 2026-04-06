import { Outlet, NavLink, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import PromptOverlay from './PromptOverlay.js';

export default function AppLayout() {
  const { signOut, user } = useAuth();
  const { roomId } = useParams<{ roomId?: string }>();

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="logo">Deck Monsters</span>
        <div className="spacer" />
        {user && (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {user.email ?? user.id.slice(0, 8)}
            </span>
            <button className="btn" onClick={() => void signOut()}>
              Sign out
            </button>
          </>
        )}
      </header>

      <nav className="app-nav">
        <NavLink to="/rooms">Rooms</NavLink>
        {roomId && (
          <>
            <NavLink to={`/ring/${roomId}`}>Ring Feed</NavLink>
            <NavLink to={`/monsters/${roomId}`}>Monsters</NavLink>
            <NavLink to={`/shop/${roomId}`}>Shop</NavLink>
            <NavLink to={`/spawn/${roomId}`}>Spawn</NavLink>
          </>
        )}
      </nav>

      <main className="app-main">
        <Outlet />
      </main>

      {/* Global prompt handler — renders when the engine asks an interactive question */}
      <PromptOverlay />
    </div>
  );
}
