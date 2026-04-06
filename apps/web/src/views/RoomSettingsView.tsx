import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';

export default function RoomSettingsView() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: room, isLoading } = trpc.room.info.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );

  const { data: members, isLoading: membersLoading } = trpc.room.members.useQuery(
    { roomId: roomId ?? '' },
    { enabled: !!roomId }
  );

  const isOwner = room?.role === 'owner';

  const deleteRoom = trpc.room.delete.useMutation({
    onSuccess: () => {
      void utils.room.list.invalidate();
      navigate('/rooms');
    },
    onError: (err) => setError(err.message),
  });

  const resetRoom = trpc.admin.resetRoom.useMutation({
    onSuccess: () => {
      setConfirmReset(false);
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  if (!roomId) return null;

  if (isLoading) return <div className="page"><div className="empty-state">Loading…</div></div>;

  if (!room) return <div className="page"><div className="empty-state">Room not found.</div></div>;

  async function copyInviteCode() {
    if (!room?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard. Please copy the code manually.');
    }
  }

  async function copyInviteLink() {
    if (!room?.inviteCode) return;
    const link = `${window.location.origin}/join/${room.inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setError('Could not copy to clipboard. Please copy the link manually.');
    }
  }

  return (
    <div className="page">
      <h1>Room Settings</h1>
      <p style={{ color: 'var(--color-fg-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        {room.name}
      </p>

      {error && <div className="error-msg">{error}</div>}

      <div className="panel">
        <p className="panel-title">Invite</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
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
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <button className="btn" onClick={() => void copyInviteLink()}>
            {copiedLink ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-fg-dim)', marginTop: '0.25rem' }}>
          Share the code or link to invite players. The link takes them directly to the join page.
        </p>
      </div>

      <div className="panel">
        <p className="panel-title">
          Members{members ? ` (${members.length})` : ''}
        </p>
        {membersLoading ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-fg-dim)' }}>Loading members…</p>
        ) : members && members.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {members.map((m) => (
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
                <span style={{ flex: 1 }}>{m.displayName}</span>
                <span className="tag">{m.role}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-fg-dim)' }}>No members yet.</p>
        )}
      </div>

      <div className="panel" style={{ borderColor: 'rgba(255,107,107,0.3)' }}>
        <p className="panel-title" style={{ color: 'var(--color-error)' }}>Danger Zone</p>

        {isOwner && (
          <div style={{ marginBottom: '1rem' }}>
            {!confirmReset ? (
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-fg-dim)', marginBottom: '0.5rem' }}>
                  Reset the game state for this room. All monsters, characters, and ring progress will be erased, but the room and its members will be kept.
                </p>
                <button
                  className="btn"
                  style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                  onClick={() => setConfirmReset(true)}
                >
                  Reset game state
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--color-fg)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                  This will erase all game state in <strong>{room.name}</strong>. Monsters, characters, and ring progress will be lost. The room and members stay. Are you sure?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn"
                    style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                    disabled={resetRoom.isPending}
                    onClick={() => resetRoom.mutate({ roomId })}
                  >
                    {resetRoom.isPending ? 'Resetting…' : 'Yes, reset it'}
                  </button>
                  <button className="btn" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isOwner && (
          !confirmDelete ? (
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
          )
        )}
      </div>
    </div>
  );
}
