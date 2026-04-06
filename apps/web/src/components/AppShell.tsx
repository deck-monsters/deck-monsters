import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { useTheme } from '../hooks/useTheme.js';

interface AppShellProps {
  children: React.ReactNode;
  roomName?: string;
}

export default function AppShell({ children, roomName }: AppShellProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

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
            <span style={{ color: 'var(--color-fg)', fontSize: '0.9rem' }}>{roomName}</span>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Desktop nav */}
        <nav
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          aria-label="Main navigation"
        >
          <Link to="/rooms" className="btn" style={{ fontSize: '0.8rem' }}>
            Rooms
          </Link>
          <Link to="/account" className="btn" style={{ fontSize: '0.8rem' }}>
            Account
          </Link>
          <button
            className="btn"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setTheme(theme === 'phosphor' ? 'amber' : 'phosphor')}
            title={`Switch to ${theme === 'phosphor' ? 'amber' : 'phosphor'} theme`}
            aria-label={`Switch to ${theme === 'phosphor' ? 'amber' : 'phosphor'} theme`}
          >
            {theme === 'phosphor' ? '🟡' : '🟢'}
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
          className="btn"
          style={{ display: 'none' }}
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
            <Link to="/account" className="btn" onClick={() => setMenuOpen(false)}>Account</Link>
            <button className="btn" onClick={() => { setTheme(theme === 'phosphor' ? 'amber' : 'phosphor'); setMenuOpen(false); }}>
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

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}
