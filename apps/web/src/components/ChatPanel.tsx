import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { ChatMessage } from '@deck-monsters/server/types';
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

// DRAFT(41): the message box's accessible name is not in the plan's text.
const INPUT_LABEL = 'Message';

function DmTag({ message, myUserId }: { message: ChatMessage; myUserId: string | undefined }) {
  const mine = message.senderUserId === myUserId;
  return (
    <span className="chat-dm-tag">{mine ? `you to ${message.recipientName ?? ''}` : 'to you'}</span>
  );
}

export default function ChatPanel({ isActive = true, headerActions }: ChatPanelProps) {
  const { messages, lastReadId, markRead, send, members } = useChat();
  const { user } = useAuth();
  const myUserId = user?.id;

  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [docVisible, setDocVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');

  // The read position as of when the panel was opened (and again each time it comes back on
  // screen). The live `lastReadId` advances as the player reads, which would drag the
  // "New since" marker along with it. Capturing waits for the first history to arrive: until
  // then `lastReadId` is 0 only because nothing has loaded.
  const [openedAtReadId, setOpenedAtReadId] = useState<number | null>(null);
  const needsCapture = useRef(true);
  const wasActive = useRef(false);
  const loaded = messages.length > 0 || lastReadId > 0;
  const lastReadRef = useRef(lastReadId);
  lastReadRef.current = lastReadId;
  useEffect(() => {
    if (isActive && !wasActive.current) needsCapture.current = true;
    wasActive.current = isActive;
    if (isActive && loaded && needsCapture.current) {
      needsCapture.current = false;
      setOpenedAtReadId(lastReadRef.current);
    }
  }, [isActive, loaded]);

  const rows = useMemo(
    () => buildChatRows(messages, { openedAtReadId, myUserId, now: new Date() }),
    [messages, openedAtReadId, myUserId],
  );

  // Follow the bottom unless the player scrolled up to read.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && isActive && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [rows, isActive]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLOP_PX;
    atBottomRef.current = bottom;
    setAtBottom(bottom);
  }

  useEffect(() => {
    const onVisibility = () => setDocVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Mark read only when the player can actually be reading: this surface is the one on
  // screen, the tab is in the foreground, and the list is scrolled to the newest message.
  // A panel left mounted behind another tab, or a page in a background browser tab, must
  // never count messages as seen.
  const newestId = messages.length > 0 ? messages[messages.length - 1]!.id : 0;
  useEffect(() => {
    if (isActive && docVisible && atBottom && newestId > 0) markRead(newestId);
  }, [isActive, docVisible, atBottom, newestId, markRead]);

  // ---- composer ----
  const [toUserId, setToUserId] = useState('');
  const [text, setText] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputId = useId();
  const selectId = useId();
  const recipient = members.find((m) => m.userId === toUserId);
  // A recipient who left the room drops out of `members`; fall back to the room.
  const effectiveTo = recipient ? toUserId : '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setRefusal(null);
    const result = await send(body, effectiveTo || undefined);
    setSending(false);
    if (result === null) {
      setText('');
      // Your own message should be in view when it lands.
      atBottomRef.current = true;
      setAtBottom(true);
    } else {
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
              return (
                <div key={row.key} className={`chat-message${dm ? ' chat-message-dm' : ''}${mine ? ' chat-message-mine' : ''}`}>
                  {dm && mine ? null : <strong className="chat-sender">{mine ? 'You' : m.senderName}</strong>}
                  {dm && <DmTag message={m} myUserId={myUserId} />}
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
        <form className="chat-composer" onSubmit={(e) => void onSubmit(e)} aria-label="Send a chat message">
          <div className="chat-composer-to">
            <label htmlFor={selectId}>To</label>
            <select id={selectId} value={effectiveTo} onChange={(e) => setToUserId(e.target.value)}>
              <option value="">Everyone</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </select>
          </div>
          {recipient && (
            <p className="chat-to-preview">
              To: <strong className="dm-preview-name">{recipient.name}</strong>
            </p>
          )}
          <div className="chat-composer-row">
            <input
              id={inputId}
              type="text"
              className="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
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
