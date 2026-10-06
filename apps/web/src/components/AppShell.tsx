import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { THEMES, useTheme } from '../hooks/useTheme.js';
import { useCommandInsert } from '../lib/command-insert-context.js';
import { surfaceDescription } from './surface-descriptions.js';
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
  // The menu shows a theme's name, not its id ("Street Fighter", not "street-fighter").
  const nameOf = (id: string) => (THEMES.find((entry) => entry.id === id)?.label ?? id).replace(/ \(.*\)$/, '');
  const themeName = nameOf(theme);
  const THEME_ICON: Record<string, string> = { phosphor: '🟢', amber: '🟡', ember: '🔴', 'street-fighter': '🕹️' };
  const nextTheme = validThemes[(validThemes.indexOf(theme) + 1) % validThemes.length];
  const [refOpen, setRefOpen] = useState(false);
  const { insertCommand } = useCommandInsert();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link
          to="/rooms"
          style={{
            flexShrink: 0,
            whiteSpace: 'nowrap',
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
                className="app-shell-room-name"
                style={{
                  color: 'var(--color-fg)',
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                }}
                title={`${roomName}: back to The Ring and Console`}
                aria-label={`Back to ${roomName}: The Ring and Console`}
              >
                {roomName}
              </Link>
            ) : (
              <span className="app-shell-room-name" title={roomName} style={{ color: 'var(--color-fg)', fontSize: '0.9rem' }}>{roomName}</span>
            )}
            {roomId && (
              <Link
                to={`/room/${roomId}/settings`}
                style={{
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
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
              The Ring
            </Link>
          )}
          <button
            className="btn"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setRefOpen(v => !v)}
            title="Console commands: every command you can type in the Console"
            aria-label="Console commands"
            aria-expanded={refOpen}
          >
            ?
          </button>
          <Link to="/rooms" className="btn" style={{ fontSize: '0.8rem' }}>
            Rooms
          </Link>
          {roomId && (
            <Link
              to={`/room/${roomId}/chat`}
              className="btn"
              style={{ fontSize: '0.8rem' }}
              title={surfaceDescription('chat')}
            >
              Chat
            </Link>
          )}
          <Link
            to={roomId ? `/room/${roomId}/leaderboard` : '/leaderboard'}
            className="btn"
            style={{ fontSize: '0.8rem' }}
          >
            Leaders
          </Link>
          {roomId && (
            <Link to={`/room/${roomId}/workshop`} className="btn" style={{ fontSize: '0.8rem' }}>
              Workshop
            </Link>
          )}
          {roomId && (
            <Link to={`/room/${roomId}/fights`} className="btn" style={{ fontSize: '0.8rem' }}>
              Fights
            </Link>
          )}
          <Link to={roomId ? `/room/${roomId}/help` : '/help'} className="btn" style={{ fontSize: '0.8rem' }}>
            Help and guides
          </Link>
          <Link to="/account" className="btn" style={{ fontSize: '0.8rem' }}>
            Account
          </Link>
          <button
            className="btn"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setTheme(nextTheme)}
            title={`Switch to the ${nameOf(nextTheme)} theme`}
            aria-label={`Switch to the ${nameOf(nextTheme)} theme`}
          >
            {THEME_ICON[theme] ?? '🎨'}
          </button>
          {user && (
            <button
              title="Sign out on this device"
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
          title="Open the menu"
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
            background: 'var(--color-backdrop)',
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
                The Ring
              </Link>
            )}
            {roomId && (
              <Link
                to={`/room/${roomId}/chat`}
                className="btn"
                title={surfaceDescription('chat')}
                onClick={() => setMenuOpen(false)}
              >
                Chat
              </Link>
            )}
            <Link
              to={roomId ? `/room/${roomId}/leaderboard` : '/leaderboard'}
              className="btn"
              onClick={() => setMenuOpen(false)}
            >
              Leaders
            </Link>
            {roomId && (
              <Link to={`/room/${roomId}/workshop`} className="btn" onClick={() => setMenuOpen(false)}>
                Workshop
              </Link>
            )}
            {roomId && (
              <Link to={`/room/${roomId}/fights`} className="btn" onClick={() => setMenuOpen(false)}>
                Fights
              </Link>
            )}
            <Link
              to={roomId ? `/room/${roomId}/help` : '/help'}
              className="btn"
              onClick={() => setMenuOpen(false)}
            >
              Help and guides
            </Link>
            <Link to="/account" className="btn" onClick={() => setMenuOpen(false)}>Account</Link>
            {/*
              Was "Help / Commands", beside "Help and guides": two items saying Help, for two
              different things (bug 229). This one is the Console's command list, so it says so.
              No aria-label: the visible words are the accessible name, for voice control.
            */}
            <button
              title="Every command you can type in the Console"
              className="btn"
              onClick={() => { setRefOpen(true); setMenuOpen(false); }}
            >
              Console commands
            </button>
            <button title="Change the theme" className="btn" onClick={() => { setTheme(nextTheme); setMenuOpen(false); }}>
              Theme: {themeName}
            </button>
            {user && (
              <button title="Sign out on this device" className="btn" onClick={() => { void handleSignOut(); setMenuOpen(false); }}>
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
