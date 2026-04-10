import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { useTheme, type Theme } from '../hooks/useTheme.js';
import { useRingKeyTimestamps } from '../hooks/useRingKeyTimestamps.js';

const THEME_LABELS: Record<Theme, string> = {
  phosphor: 'Phosphor (green on black)',
  amber: 'Amber (orange on black)',
  'street-fighter': 'Street Fighter (SNES, 1992)',
};

export default function AccountView() {
  const { user, signOut } = useAuth();
  const { theme, setTheme, validThemes } = useTheme();
  const { ringKeyTimestampsEnabled, setRingKeyTimestampsEnabled } = useRingKeyTimestamps();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  if (!user) return null;

  return (
    <div className="page">
      <h1>Account</h1>

      <div className="panel">
        <p className="panel-title">Profile</p>
        <dl style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <dt style={{ color: 'var(--color-fg-dim)', minWidth: 80 }}>Email</dt>
            <dd style={{ color: 'var(--color-fg)' }}>{user.email}</dd>
          </div>
          {user.user_metadata?.['full_name'] && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <dt style={{ color: 'var(--color-fg-dim)', minWidth: 80 }}>Name</dt>
              <dd style={{ color: 'var(--color-fg)' }}>{user.user_metadata['full_name'] as string}</dd>
            </div>
          )}
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
            {validThemes.map((t) => (
              <label
                key={t}
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
                  value={t}
                  checked={theme === t}
                  onChange={() => setTheme(t)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span style={{ color: theme === t ? 'var(--color-fg-bright)' : 'var(--color-fg)' }}>
                  {THEME_LABELS[t]}
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
