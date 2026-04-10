import { Link } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';

const THIRTY_MIN_MS = 30 * 60 * 1000;

export default function CatchUpBanner({ roomId }: { roomId: string }) {
  const { data: room } = trpc.room.info.useQuery({ roomId });
  const lastSeen = room?.lastSeenAt ? new Date(room.lastSeenAt as string) : null;
  const since = lastSeen ? lastSeen.toISOString() : undefined;

  const catchUp = trpc.game.catchUp.useQuery(
    { roomId, since, touchLastSeen: false },
    {
      enabled: !!room && !!lastSeen && Date.now() - lastSeen.getTime() > THIRTY_MIN_MS,
    }
  );

  if (!lastSeen) return null;
  const awayMs = Date.now() - lastSeen.getTime();
  if (awayMs <= THIRTY_MIN_MS) return null;
  if (!catchUp.data || catchUp.data.fightCount <= 0) return null;

  const hours = Math.floor(awayMs / 3600000);
  const mins = Math.floor((awayMs % 3600000) / 60000);
  const label = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

  return (
    <div
      style={{
        margin: '0 1rem 0.75rem',
        padding: '0.75rem 1rem',
        border: '1px solid var(--color-accent)',
        borderRadius: 6,
        background: 'var(--color-bg-elevated, var(--color-bg))',
        fontSize: '0.9rem',
      }}
    >
      You were away for {label}. {catchUp.data.fightCount} fight{catchUp.data.fightCount === 1 ? '' : 's'} happened.{' '}
      <Link to={`/room/${roomId}/fights`} style={{ color: 'var(--color-accent)' }}>
        See what you missed
      </Link>
    </div>
  );
}
