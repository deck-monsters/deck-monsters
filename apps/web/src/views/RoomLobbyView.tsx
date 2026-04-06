import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';

export default function RoomLobbyView() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [searchParams] = useSearchParams();

  const { data: rooms, isLoading } = trpc.room.list.useQuery();

  const [newRoomName, setNewRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState(searchParams.get('invite') ?? '');
  const [error, setError] = useState<string | null>(null);

  const createRoom = trpc.room.create.useMutation({
    onSuccess: (data) => {
      void utils.room.list.invalidate();
      navigate(`/room/${data.roomId}`);
    },
    onError: (err) => setError(err.message),
  });

  const joinRoom = trpc.room.join.useMutation({
    onSuccess: (data) => {
      void utils.room.list.invalidate();
      navigate(`/room/${data.roomId}`);
    },
    onError: (err) => setError(err.message),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setError(null);
    createRoom.mutate({ name: newRoomName.trim() });
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setError(null);
    joinRoom.mutate({ inviteCode: inviteCode.trim().toUpperCase() });
  }

  return (
    <div className="page">
      <h1>Rooms</h1>

      {error && <div className="error-msg">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="panel">
          <p className="panel-title">Create a room</p>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="new-room-name">Room name</label>
              <input
                id="new-room-name"
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="My Arena"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createRoom.isPending}
            >
              {createRoom.isPending ? 'Creating…' : 'Create room'}
            </button>
          </form>
        </div>

        <div className="panel">
          <p className="panel-title">Join a room</p>
          <form onSubmit={handleJoin}>
            <div className="form-group">
              <label htmlFor="invite-code">Invite code</label>
              <input
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="ABC12345"
                maxLength={8}
                style={{ textTransform: 'uppercase' }}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={joinRoom.isPending}
            >
              {joinRoom.isPending ? 'Joining…' : 'Join room'}
            </button>
          </form>
        </div>
      </div>

      <h2>Your rooms</h2>

      {isLoading && <div className="empty-state">Loading…</div>}

      {rooms && rooms.length === 0 && (
        <div className="empty-state">
          You haven't joined any rooms yet. Create one or use an invite code.
        </div>
      )}

      {rooms && rooms.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rooms.map((room) => (
            <div
              key={room.roomId}
              className="panel"
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => navigate(`/room/${room.roomId}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/room/${room.roomId}`); }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-fg-bright)' }}>
                  {room.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-fg-dim)' }}>
                  <span className="tag">{room.role}</span>
                </div>
              </div>
              <button
                className="btn"
                onClick={(e) => { e.stopPropagation(); navigate(`/room/${room.roomId}`); }}
                aria-label={`Enter ${room.name}`}
              >
                Enter
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
