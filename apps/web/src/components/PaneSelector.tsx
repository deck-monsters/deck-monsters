import { useChat } from '../hooks/useChat.js';
import { unreadBadgeText } from '../utils/chat-rows.js';
import { SURFACES, type SurfaceId } from './surfaces.js';

interface PaneSelectorProps {
  /** The surface this slot currently shows. */
  value: SurfaceId;
  /** The surface the *other* slot shows, excluded from the options — no duplicates (§3.2). */
  excludeSurfaceId: SurfaceId;
  onChange: (surfaceId: SurfaceId) => void;
  /** For the accessible label — which slot this is ("left pane", "right pane"). */
  slotLabel: string;
}

/**
 * The small, pane-local control that lets a viewer pick which surface a slot shows
 * (docs/architecture/web-workspace.md). Deliberately a plain `<select>`: the ring
 * pane header already carries a timer badge and a summons counter, so anything heavier
 * would crowd them.
 */
export default function PaneSelector({ value, excludeSurfaceId, onChange, slotLabel }: PaneSelectorProps) {
  // Side by side there is no tab bar to carry the Chat unread badge, so the count rides in
  // the option's text (roadmap 41).
  const { unread } = useChat();
  const options = SURFACES.filter((surface) => surface.id !== excludeSurfaceId);

  return (
    <select
      className="pane-selector"
      aria-label={`Surface shown in the ${slotLabel}`}
      value={value}
      onChange={(event) => onChange(event.target.value as SurfaceId)}
    >
      {options.map((surface) => (
        <option key={surface.id} value={surface.id}>
          {optionLabel(surface, unread)}
        </option>
      ))}
    </select>
  );
}

function optionLabel(surface: (typeof SURFACES)[number], chatUnread: number): string {
  const badge = unreadBadgeText(surface.badge?.({ chatUnread }) ?? 0);
  return badge ? `${surface.label} · ${badge} ${surface.badgeNoun ?? ''}`.trim() : surface.label;
}
