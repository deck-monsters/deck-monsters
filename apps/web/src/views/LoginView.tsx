import { useState } from 'react';
import { useAuth } from '../lib/auth-context.js';

type Mode = 'signin' | 'signup';

export default function LoginView() {
  const { signInWithDiscord, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const err =
      mode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);

    setLoading(false);

    if (err) {
      setError(err);
    } else if (mode === 'signup') {
      setMessage('Check your email to confirm your account.');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h1
          style={{
            textAlign: 'center',
            marginBottom: 8,
            color: 'var(--color-fg-bright)',
            letterSpacing: '0.1em',
            fontSize: '1.4rem',
          }}
        >
          DECK MONSTERS
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--color-fg-dim)',
            fontSize: 13,
            marginBottom: 24,
            letterSpacing: '0.05em',
          }}
        >
          Turn-based monster battling arena
        </p>

        {error && <div className="error-msg">{error}</div>}
        {message && <div className="success-msg">{message}</div>}

        <div className="panel">
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
            onClick={() => void signInWithDiscord()}
          >
            Sign in with Discord
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              color: 'var(--color-fg-dim)',
              fontSize: 12,
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            or
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          <form onSubmit={(e) => void handleEmailSubmit(e)}>
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-fg-dim)', marginTop: 12 }}>
            {mode === 'signin' ? (
              <>
                No account?{' '}
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                  }}
                  onClick={() => { setMode('signup'); setError(null); }}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                  }}
                  onClick={() => { setMode('signin'); setError(null); }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
