import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { surfaceDescription } from './surface-descriptions.js';
import { useChat } from '../hooks/useChat.js';
import { useAuth } from '../lib/auth-context.js';
import { buildChatRows } from '../utils/chat-rows.js';

interface ChatPanelProps {
  /** The room is implied by the surrounding `ChatProvider`; kept so the surface registry can pass it uniformly. */
  roomId?: string;
  /** Whether this surface is the one on screen. Hidden panels stay mounted and never mark read. */
  isActive?: boolean;
  headerActions?: ReactNode;
}

// How close to the bottom still counts as "at the bottom" (sub-pixel rounding, momentum).
const BOTTOM_SLOP_PX = 24;

const INPUT_LABEL = 'Your message';

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Changes when the local date does, so "Today" / "Yesterday" divider labels are recomputed
 * after midnight instead of staying as they were when the panel was drawn.
 */
function useLocalDay(): string {
  const [day, setDay] = useState(() => localDayKey(new Date()));
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    const timer = setTimeout(() => setDay(localDayKey(new Date())), nextMidnight.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [day]);
  return day;
}

export default function ChatPanel({ isActive = true, headerActions }: ChatPanelProps) {
  const { messages, lastReadId, loaded, markRead, send, members } = useChat();
  const { user } = useAuth();
  const myUserId = user?.id;
  const today = useLocalDay();

  const listRef = useRef<HTMLDivElement>(null);
  // Whether the list is pinned to the newest message. A ref for the layout effect and a copy
  // in state for rendering the jump cue and gating mark-read.
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  // When the player left the bottom (or opened onto the marker), the newest id then; anything
  // newer is "below" and earns the jump cue. null while at the bottom.
  const [leftAtId, setLeftAtId] = useState<number | null>(null);
  const [docVisible, setDocVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');

  // The read position as of when the panel was opened (and again each time it comes back on
  // screen). The live `lastReadId` advances as the player reads, which would drag the
  // "New since" marker along with it. Capturing waits for the first history to load: until
  // then `lastReadId` is 0 only because nothing has arrived, and a live frame landing first
  // must not fix the marker at 0.
  const [openedAtReadId, setOpenedAtReadId] = useState<number | null>(null);
  // After a capture the list scrolls to the marker (or the bottom) once; until it has, the
  // panel is not "at the bottom" for mark-read purposes. Ref for the effects, state to rerun them.
  const needsCapture = useRef(true);
  const initialScrollPending = useRef(false);
  const [initialScroll, setInitialScroll] = useState(false);
  const wasActive = useRef(false);
  const lastReadRef = useRef(lastReadId);
  lastReadRef.current = lastReadId;
  useEffect(() => {
    if (isActive && !wasActive.current) needsCapture.current = true;
    wasActive.current = isActive;
    if (isActive && loaded && needsCapture.current) {
      needsCapture.current = false;
      initialScrollPending.current = true;
      setOpenedAtReadId(lastReadRef.current);
      setInitialScroll(true);
    }
  }, [isActive, loaded]);

  const rows = useMemo(
    () => buildChatRows(messages, { openedAtReadId, myUserId, now: new Date() }),
    // `today` is a dependency so labels are recomputed when the date rolls over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, openedAtReadId, myUserId, today],
  );
  const newestId = messages.length > 0 ? messages[messages.length - 1]!.id : 0;

  const measureBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLOP_PX;

  // On opening: show the "New since you were last here" marker if there is one (unread
  // messages sit below it), otherwise the newest message. Unread is only marked read once the
  // player reaches the bottom themselves.
  useLayoutEffect(() => {
    if (!initialScroll) return;
    const el = listRef.current;
    if (el) {
      const marker = el.querySelector<HTMLElement>('.chat-divider-marker');
      if (marker) {
        el.scrollTop = Math.max(0, marker.offsetTop - el.offsetTop - 8);
        const bottom = measureBottom(el);
        atBottomRef.current = bottom;
        setAtBottom(bottom);
        setLeftAtId(bottom ? null : openedAtReadId);
      } else {
        el.scrollTop = el.scrollHeight;
        atBottomRef.current = true;
        setAtBottom(true);
        setLeftAtId(null);
      }
    }
    initialScrollPending.current = false;
    setInitialScroll(false);
  }, [initialScroll, openedAtReadId]);

  // Follow the bottom unless the player scrolled up to read.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && isActive && atBottomRef.current && !initialScrollPending.current) el.scrollTop = el.scrollHeight;
  }, [rows, isActive]);

  function onScroll() {
    const el = listRef.current;
    if (!el || initialScrollPending.current) return;
    const bottom = measureBottom(el);
    if (bottom === atBottomRef.current) return;
    atBottomRef.current = bottom;
    setAtBottom(bottom);
    setLeftAtId(bottom ? null : newestId);
  }

  const jumpToNewest = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setAtBottom(true);
    setLeftAtId(null);
  }, []);

  useEffect(() => {
    const onVisibility = () => setDocVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Mark read only when the player can actually be reading: this surface is the one on
  // screen, the tab is in the foreground, and the list is scrolled to the newest message
  // (after the opening scroll has settled). A panel left mounted behind another tab, or a page
  // in a background browser tab, must never count messages as seen.
  useEffect(() => {
    if (needsCapture.current || initialScrollPending.current) return;
    // The ref, not the state: right after the opening scroll the state is one render behind.
    if (isActive && docVisible && atBottomRef.current && newestId > 0) markRead(newestId);
  }, [isActive, docVisible, atBottom, newestId, markRead, initialScroll, openedAtReadId]);

  const showJump = !atBottom && leftAtId !== null && newestId > leftAtId;

  // ---- composer ----
  const [toUserId, setToUserId] = useState('');
  const [text, setText] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const inputId = useId();
  const selectId = useId();
  const recipient = members.find((m) => m.userId === toUserId);
  // A recipient who left the room drops out of `members`; fall back to the room.
  const effectiveTo = recipient ? toUserId : '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    // A ref, not the `sending` state: two Enters can land before a re-render.
    if (!body || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setRefusal(null);
    // Cleared at once so what the player types next is not lost when the answer comes back.
    setText('');
    const result = await send(body, effectiveTo || undefined);
    sendingRef.current = false;
    setSending(false);
    if (result === null) {
      // Your own message should be in view when it lands.
      atBottomRef.current = true;
      setAtBottom(true);
      setLeftAtId(null);
    } else {
      // Refused: give the text back, unless they have already started something new.
      setText((current) => (current === '' ? body : current));
      setRefusal(result);
    }
  }

  return (
    <div className="surface-panel-host">
      <section className="surface-panel chat-panel">
        <header className="surface-panel-heading">
          <div>
            <h1>Chat</h1>
            <p className="surface-panel-subtitle">{surfaceDescription('chat')}</p>
          </div>
          <div className="surface-panel-actions">{headerActions}</div>
        </header>
        <div className="pane-feed-area">
          <div
            className="chat-list"
            ref={listRef}
            onScroll={onScroll}
            role="log"
            aria-label="Chat messages"
            tabIndex={0}
          >
            {messages.length === 0 && (
              <p className="surface-muted chat-empty">No messages yet. Say hello, or cheer on a fight.</p>
            )}
            {rows.map((row) => {
              if (row.kind === 'message') {
                const m = row.message;
                const dm = m.recipientUserId !== null;
                const mine = m.senderUserId === myUserId;
                // The Console's wording: `✉️ Ben to you: …` / `✉️ You to Ben: …`.
                const header = dm
                  ? `✉️ ${mine ? 'You' : m.senderName} to ${mine ? (m.recipientName ?? '') : 'you'}`
                  : mine ? 'You' : m.senderName;
                return (
                  <div key={row.key} className={`chat-message${dm ? ' chat-message-dm' : ''}${mine ? ' chat-message-mine' : ''}`}>
                    <strong className="chat-sender">{header}</strong>
                    {/* The time of day, beside the sender. Hidden by base CSS; a theme that
                        styles .chat-time shows it (Millefleur). */}
                    <time className="chat-time" dateTime={m.createdAt}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </time>
                    <span className="chat-text">{m.text}</span>
                  </div>
                );
              }
              const cls = row.kind === 'time' ? 'chat-divider chat-divider-time' : row.kind === 'fight' ? 'chat-divider chat-divider-fight' : 'chat-divider chat-divider-marker';
              return (
                <div key={row.key} className={cls} role="separator" aria-label={row.label}>
                  <span>{row.label}</span>
                </div>
              );
            })}
          </div>
          {showJump && (
            <button type="button" title="Jump to the newest messages" className="jump-to-bottom" onClick={jumpToNewest}>
              ↓ New messages
            </button>
          )}
        </div>
        <form className="chat-composer" onSubmit={(e) => void onSubmit(e)} aria-label="Send a chat message">
          <div className="chat-composer-to">
            <label htmlFor={selectId}>To</label>
            {/* A chosen player takes the highlight (same look as the Console's DM preview), so
                the person can see who the message goes to before sending. */}
            <select
              id={selectId}
              className={recipient ? 'dm-preview-name chat-to-picked' : undefined}
              value={effectiveTo}
              onChange={(e) => setToUserId(e.target.value)}
            >
              <option value="">Everyone</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="chat-composer-row">
            <input
              id={inputId}
              type="text"
              className="chat-input"
              value={text}
              onChange={(e) => { setText(e.target.value); setRefusal(null); }}
              placeholder={recipient ? `Message ${recipient.name}…` : 'Message everyone…'}
              aria-label={INPUT_LABEL}
              aria-invalid={refusal ? true : undefined}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button type="submit" className="btn btn-primary" title="Send this message" disabled={sending}>
              Send
            </button>
          </div>
          {refusal && <p className="chat-refusal" role="alert">{refusal}</p>}
        </form>
      </section>
    </div>
  );
}
