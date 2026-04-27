import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { useTheme } from '../hooks/useTheme.js';
import { useCommandInsert } from '../lib/command-insert-context.js';
import CommandReference from './CommandReference.js';

interface AppShellProps {
  children: React.ReactNode;
  roomName?: string;
  roomId?: string;
}

export default function AppShell({ children, roomName, roomId }: AppShellProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme, validThemes } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const THEME_ICON: Record<string, string> = { phosphor: '🟢', amber: '🟡', 'street-fighter': '🕹️' };
  const nextTheme = validThemes[(validThemes.indexOf(theme) + 1) % validThemes.length];
  const [refOpen, setRefOpen] = useState(false);
  const { insertCommand } = useCommandInsert();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header
        style={{
          height: 'var(--header-height)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          gap: '1rem',
          flexShrink: 0,
          background: 'var(--color-bg)',
        }}
      >
        <Link
          to="/rooms"
          style={{
            color: 'var(--color-fg-bright)',
            textDecoration: 'none',
            fontWeight: 700,
            letterSpacing: '0.05em',
            fontSize: '0.9rem',
          }}
        >
          DECK MONSTERS
        </Link>

        {roomName && (
          <>
            <span style={{ color: 'var(--color-fg-dim)' }}>/</span>
            {roomId ? (
              <Link
                to={`/room/${roomId}`}
                style={{
                  color: 'var(--color-fg)',
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                }}
                title="Back to Ring and Console"
                aria-label={`Back to ${roomName} terminal`}
              >
                {roomName}
              </Link>
            ) : (
              <span style={{ color: 'var(--color-fg)', fontSize: '0.9rem' }}>{roomName}</span>
            )}
            {roomId && (
              <Link
                to={`/room/${roomId}/settings`}
                style={{
                  color: 'var(--color-fg-dim)',
                  textDecoration: 'none',
                  fontSize: '0.8rem',
                  padding: '0.15rem 0.3rem',
                  border: '1px solid var(--color-border)',
                }}
                title="Room settings"
                aria-label="Room settings"
              >
                ⚙
              </Link>
            )}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Desktop nav */}
        <nav
          className="header-nav"
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          aria-label="Main navigation"
        >
          {roomId && (
            <Link to={`/room/${roomId}`} className="btn" style={{ fontSize: '0.8rem' }}>
              Terminal
            </Link>
          )}
          <button
            className="btn"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setRefOpen(v => !v)}
            title="Command reference"
            aria-label="Open command reference"
            aria-expanded={refOpen}
          >
            ?
          </button>
          <Link to="/rooms" className="btn" style={{ fontSize: '0.8rem' }}>
            Rooms
          </Link>
          <Link
            to={roomId ? `/room/${roomId}/leaderboard` : '/leaderboard'}
            className="btn"
            style={{ fontSize: '0.8rem' }}
          >
            Leaderboard
          </Link>
          {roomId && (
            <Link to={`/room/${roomId}/workshop`} className="btn" style={{ fontSize: '0.8rem' }}>
              Workshop
            </Link>
          )}
          {roomId && (
            <Link to={`/room/${roomId}/fights`} className="btn" style={{ fontSize: '0.8rem' }}>
              Fight log
            </Link>
          )}
          <Link to="/account" className="btn" style={{ fontSize: '0.8rem' }}>
            Account
          </Link>
          <button
            className="btn"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setTheme(nextTheme)}
            title={`Switch to ${nextTheme} theme`}
            aria-label={`Switch to ${nextTheme} theme`}
          >
            {THEME_ICON[theme] ?? '🎨'}
          </button>
          {user && (
            <button
              className="btn"
              style={{ fontSize: '0.8rem' }}
              onClick={() => void handleSignOut()}
            >
              Sign out
            </button>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="btn header-hamburger"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        >
          ☰
        </button>
      </header>

      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
          }}
          onClick={() => setMenuOpen(false)}
          role="presentation"
        >
          <nav
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 240,
              height: '100%',
              background: 'var(--color-bg)',
              borderLeft: '1px solid var(--color-border)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
            aria-label="Mobile menu"
            onClick={(e) => e.stopPropagation()}
          >
            <Link to="/rooms" className="btn" onClick={() => setMenuOpen(false)}>Rooms</Link>
            {roomId && (
              <Link to={`/room/${roomId}`} className="btn" onClick={() => setMenuOpen(false)}>
                Terminal
              </Link>
            )}
            <Link
              to={roomId ? `/room/${roomId}/leaderboard` : '/leaderboard'}
              className="btn"
              onClick={() => setMenuOpen(false)}
            >
              Leaderboard
            </Link>
            {roomId && (
              <Link to={`/room/${roomId}/workshop`} className="btn" onClick={() => setMenuOpen(false)}>
                Workshop
              </Link>
            )}
            {roomId && (
              <Link to={`/room/${roomId}/fights`} className="btn" onClick={() => setMenuOpen(false)}>
                Fight log
              </Link>
            )}
            <Link to="/account" className="btn" onClick={() => setMenuOpen(false)}>Account</Link>
            <button
              className="btn"
              onClick={() => { setRefOpen(true); setMenuOpen(false); }}
              aria-label="Open command reference"
            >
              Help / Commands
            </button>
            <button className="btn" onClick={() => { setTheme(nextTheme); setMenuOpen(false); }}>
              Theme: {theme}
            </button>
            {user && (
              <button className="btn" onClick={() => { void handleSignOut(); setMenuOpen(false); }}>
                Sign out
              </button>
            )}
          </nav>
        </div>
      )}

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </main>

      <CommandReference
        open={refOpen}
        onClose={() => setRefOpen(false)}
        onInsertCommand={(cmd) => { insertCommand(cmd); }}
      />
    </div>
  );
}
