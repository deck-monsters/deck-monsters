import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';

export default function RoomSettingsView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: room, isLoading } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );

  const deleteRoom = trpc.room.delete.useMutation({
    onSuccess: () => {
      void utils.room.list.invalidate();
      navigate('/rooms');
    },
    onError: (err) => setError(err.message),
  });

  if (!roomId) return null;

  if (isLoading) return <div className="page"><div className="empty-state">Loading…</div></div>;

  if (!room) return <div className="page"><div className="empty-state">Room not found.</div></div>;

  async function copyInviteCode() {
    if (!room?.inviteCode) return;
    await navigator.clipboard.writeText(room.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page">
      <h1>Room Settings</h1>
      <p style={{ color: 'var(--color-fg-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        {room.name}
      </p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <p className="panel-title">Invite Code</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <code
            style={{
              flex: 1,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              padding: '0.4rem 0.6rem',
              letterSpacing: '0.1em',
              color: 'var(--color-fg-bright)',
              fontSize: '1rem',
            }}
          >
            {room.inviteCode}
          </code>
          <button className="btn" onClick={() => void copyInviteCode()}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-fg-dim)', marginTop: '0.5rem' }}>
          Share this code to invite players to your room.
        </p>
      </div>

      {'members' in room && Array.isArray((room as { members?: unknown[] }).members) && (
        <div className="panel">
          <p className="panel-title">Members ({(room as { members: unknown[] }).members.length})</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {(room as { members: Array<{ userId: string; name: string; role: string }> }).members.map((m) => (
              <li
                key={m.userId}
                style={{
                  padding: '0.3rem 0',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: 'var(--color-fg)',
                  fontSize: '0.875rem',
                }}
              >
                <span style={{ flex: 1 }}>{m.name}</span>
                <span className="tag">{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel" style={{ borderColor: 'rgba(255,107,107,0.3)' }}>
        <p className="panel-title" style={{ color: 'var(--color-error)' }}>Danger Zone</p>
        {!confirmDelete ? (
          <button
            className="btn"
            style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete room
          </button>
        ) : (
          <div>
            <p style={{ color: 'var(--color-fg)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
              This will permanently delete <strong>{room.name}</strong> and all its data. Are you sure?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn"
                style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                disabled={deleteRoom.isPending}
                onClick={() => deleteRoom.mutate({ roomId })}
              >
                {deleteRoom.isPending ? 'Deleting…' : 'Yes, delete it'}
              </button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
