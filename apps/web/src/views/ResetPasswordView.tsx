import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';
import { supabase } from '../lib/supabase.js';

export default function ResetPasswordView() {
  const { session, loading, passwordRecovery, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recoverySessionPending, setRecoverySessionPending] = useState(false);

  const recoveryFromUrl =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery' ||
      new URLSearchParams(window.location.search).get('type') === 'recovery');

  useEffect(() => {
    if (!recoveryFromUrl || session) {
      setRecoverySessionPending(false);
      return;
    }
    setRecoverySessionPending(true);
    let tries = 0;
    const maxTries = 25;
    let cancelled = false;
    let id: number | undefined;
    const poll = () => {
      if (cancelled) return;
      tries += 1;
      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        if (data.session) {
          if (id !== undefined) window.clearInterval(id);
          setRecoverySessionPending(false);
          return;
        }
        if (tries >= maxTries) {
          if (id !== undefined) window.clearInterval(id);
          setRecoverySessionPending(false);
        }
      });
    };
    poll();
    id = window.setInterval(poll, 200);
    return () => {
      cancelled = true;
      if (id !== undefined) window.clearInterval(id);
    };
  }, [recoveryFromUrl, session]);

  const canSetPassword = Boolean(session && (passwordRecovery || recoveryFromUrl));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const err = await updatePassword(password);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    navigate('/rooms', { replace: true });
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg)',
          color: 'var(--color-fg-dim)',
          fontFamily: 'var(--font-family)',
        }}
      >
        loading…
      </div>
    );
  }

  if (!session) {
    if (recoveryFromUrl && recoverySessionPending) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg)',
            color: 'var(--color-fg-dim)',
            fontFamily: 'var(--font-family)',
          }}
        >
          Verifying reset link…
        </div>
      );
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
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-fg-dim)', marginBottom: 16 }}>
            This reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!canSetPassword) {
    return <Navigate to="/rooms" replace />;
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
          SET NEW PASSWORD
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
          Choose a new password for your account.
        </p>

        {error && <div className="error-msg">{error}</div>}

        <div className="panel">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="form-group">
              <label htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="reset-password-confirm">Confirm password</label>
              <input
                id="reset-password-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={submitting}
            >
              {submitting ? 'Please wait…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
