import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { THEMES, useTheme } from '../hooks/useTheme.js';
import { useRingKeyTimestamps } from '../hooks/useRingKeyTimestamps.js';
import { trpc } from '../lib/trpc.js';

export default function AccountView() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { ringKeyTimestampsEnabled, setRingKeyTimestampsEnabled } = useRingKeyTimestamps();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: profile } = trpc.profile.me.useQuery();
  const [displayName, setDisplayName] = useState('');
  const hasInitializedDisplayName = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [renamedCharacters, setRenamedCharacters] = useState<number | null>(null);

  useEffect(() => {
    if (profile && !hasInitializedDisplayName.current) {
      setDisplayName(profile.displayName);
      hasInitializedDisplayName.current = true;
    }
  }, [profile]);

  const updateDisplayName = trpc.profile.updateDisplayName.useMutation({
    onSuccess: ({ displayName: savedDisplayName, renamedCharacters: savedRenamedCharacters }) => {
      setDisplayName(savedDisplayName);
      setError(null);
      setRenamedCharacters(savedRenamedCharacters);
      void Promise.all([
        utils.profile.me.invalidate(),
        utils.room.members.invalidate(),
        utils.leaderboard.roomPlayers.invalidate(),
        utils.leaderboard.roomMonsters.invalidate(),
        utils.leaderboard.globalPlayers.invalidate(),
        utils.leaderboard.globalMonsters.invalidate(),
      ]);
    },
    onError: (mutationError) => {
      setRenamedCharacters(null);
      setError(mutationError.message);
    },
  });

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  function handleDisplayNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRenamedCharacters(null);
    updateDisplayName.mutate({ displayName: displayName.trim() });
  }

  if (!user) return null;

  return (
    <div className="page">
      <h1>Account</h1>

      <div className="panel">
        <p className="panel-title">Profile</p>
        <form onSubmit={handleDisplayNameSubmit} className="form-group" style={{ marginBottom: '1rem' }}>
          <label htmlFor="display-name" style={{ display: 'block', marginBottom: '0.4rem' }}>
            Display name
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={32}
              autoComplete="nickname"
              style={{ flex: 1 }}
            />
            <button className="btn" type="submit" disabled={updateDisplayName.isPending}>
              {updateDisplayName.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-fg-dim)', marginTop: '0.4rem', lineHeight: 1.45 }}>
            Shown on leaderboards and in room member lists. New characters start with this name; a character you renamed with <code>edit my character</code> keeps its own name.
          </p>
          {error && <p role="alert" className="error-msg">{error}</p>}
          {renamedCharacters !== null && (
            <p style={{ color: 'var(--color-success)', marginTop: '0.4rem' }}>
              Saved{renamedCharacters > 0 ? ` — ${renamedCharacters} room character(s) renamed to match.` : '.'}
            </p>
          )}
        </form>
        <dl style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <dt style={{ color: 'var(--color-fg-dim)', minWidth: 80 }}>Email</dt>
            <dd style={{ color: 'var(--color-fg)' }}>{user.email}</dd>
          </div>
          {user.app_metadata?.['provider'] && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <dt style={{ color: 'var(--color-fg-dim)', minWidth: 80 }}>Auth</dt>
              <dd>
                <span className="tag">{user.app_metadata['provider'] as string}</span>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="panel">
        <p className="panel-title">Appearance</p>
        <div className="form-group">
          <label htmlFor="theme-select" style={{ display: 'block', marginBottom: '0.4rem' }}>
            Terminal theme
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {THEMES.map(({ id, label }) => (
              <label
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  padding: '0.3rem 0',
                }}
              >
                <input
                  type="radio"
                  name="theme"
                  value={id}
                  checked={theme === id}
                  onChange={() => setTheme(id)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span style={{ color: theme === id ? 'var(--color-fg-bright)' : 'var(--color-fg)' }}>
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              cursor: 'pointer',
              padding: '0.3rem 0',
            }}
          >
            <input
              type="checkbox"
              checked={ringKeyTimestampsEnabled}
              onChange={(e) => setRingKeyTimestampsEnabled(e.target.checked)}
              style={{ accentColor: 'var(--color-accent)', marginTop: '0.15rem' }}
            />
            <span>
              <span style={{ color: 'var(--color-fg-bright)' }}>Show key event times in the Ring</span>
              <span
                style={{
                  display: 'block',
                  marginTop: '0.25rem',
                  fontSize: '0.8rem',
                  color: 'var(--color-fg-dim)',
                  lineHeight: 1.45,
                }}
              >
                When on, join/leave/fight start/end show a small label and “time ago” on the right.
                Off by default for a single-column terminal look and narrow screens. Hover any line for
                the exact time; off does not remove that.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="panel">
        <p className="panel-title">Session</p>
        <button
          className="btn"
          onClick={() => void handleSignOut()}
          style={{ borderColor: 'var(--color-fg-dim)' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
