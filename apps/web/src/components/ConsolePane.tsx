import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameEvent } from '@deck-monsters/server/types';

type TrackedEvent = { id: string; data: GameEvent };
import { trpc } from '../lib/trpc.js';
import { useAuth } from '../lib/auth-context.js';
import { useHandshake } from '../hooks/useHandshake.js';
import { useCommandInsert } from '../lib/command-insert-context.js';
import { useCommandAutocomplete } from '../hooks/useCommandAutocomplete.js';
import CommandSuggestions from './CommandSuggestions.js';
import InlineChoices from './InlineChoices.js';

interface ActivePrompt {
  requestId: string;
  question: string;
  choices: string[];
  timedOut: boolean;
  cancelled: boolean;
  selectedAnswer: string | null;
  timeoutSeconds?: number;
  arrivedAt: number;
}

interface ConsoleEvent {
  id: string;
  type: 'announce' | 'input' | 'system' | 'prompt' | 'tombstone';
  text: string;
  promptData?: ActivePrompt;
}

interface QuickAction {
  label: string;
  command: string;
}

interface ConsolePaneProps {
  roomId: string;
  isActive: boolean;
  /** Called with each incoming private event so Terminal can track lastEventId */
  onEvent?: (event: unknown) => void;
}

export default function ConsolePane({ roomId, isActive, onEvent }: ConsolePaneProps) {
  const { user } = useAuth();
  const { handleHandshakeEvent } = useHandshake();
  const { registerInsertFn } = useCommandInsert();

  const [consoleEvents, setConsoleEvents] = useState<ConsoleEvent[]>([]);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputLocked, setInputLocked] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);

  const feedRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenRef = useRef(new Set<string>());
  const lastEventIdRef = useRef<string | undefined>(undefined);

  // Register command-insert function so external callers (CommandReference, etc.) can populate the input
  useEffect(() => {
    registerInsertFn((command: string) => {
      setInputValue(command);
      inputRef.current?.focus();
    });
  }, [registerInsertFn]);

  // Auto-scroll when new events arrive
  useEffect(() => {
    if (isAtBottom && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [consoleEvents, isAtBottom]);

  const handleScroll = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 50);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    setIsAtBottom(true);
  }, []);

  const suggestions = useCommandAutocomplete(inputValue, !activePromptId && !inputLocked);

  const sendCommand = trpc.game.command.useMutation();
  const respondToPrompt = trpc.game.respondToPrompt.useMutation();
  const cancelPromptMutation = trpc.game.cancelPrompt.useMutation();
  const cancelFlowMutation = trpc.game.cancelFlow.useMutation();

  function addConsoleEvent(ev: ConsoleEvent) {
    setConsoleEvents(prev => [...prev, ev]);
  }

  trpc.game.ringFeed.useSubscription(
    { roomId, lastEventId: lastEventIdRef.current },
    {
      onData(tracked: TrackedEvent) {
        const event = tracked.data;
        if (seenRef.current.has(tracked.id)) return;
        seenRef.current.add(tracked.id);
        lastEventIdRef.current = tracked.id;

        if (event.type === 'handshake') {
          handleHandshakeEvent(event);
          setReconnecting(false);
          return;
        }

        // Only process events targeted to this user
        const isPrivate = event.scope === 'private' && event.targetUserId === user?.id;
        const isPublicSystem = event.scope === 'public' && event.type === 'system';
        if (!isPrivate && !isPublicSystem) return;

        onEvent?.(event);

        if (event.type === 'announce' || event.type === 'system') {
          addConsoleEvent({
            id: event.id,
            type: event.type === 'system' ? 'system' : 'announce',
            text: event.text,
          });
          return;
        }

        if (event.type === 'prompt.request') {
          const payload = event.payload as {
            requestId: string;
            question: string;
            choices: string[];
            timeoutSeconds?: number;
          };
          const promptData: ActivePrompt = {
            requestId: payload.requestId,
            question: payload.question,
            choices: payload.choices,
            timedOut: false,
            cancelled: false,
            selectedAnswer: null,
            timeoutSeconds: payload.timeoutSeconds,
            arrivedAt: Date.now(),
          };
          addConsoleEvent({
            id: event.id,
            type: 'prompt',
            text: payload.question,
            promptData,
          });
          setActivePromptId(payload.requestId);
          return;
        }

        if (event.type === 'prompt.timeout') {
          const { requestId } = event.payload as { requestId: string };
          setConsoleEvents(prev => prev.map(ev =>
            ev.promptData?.requestId === requestId
              ? { ...ev, promptData: { ...ev.promptData!, timedOut: true } }
              : ev
          ));
          if (activePromptId === requestId) {
            setActivePromptId(null);
            setInputLocked(false);
          }
          addConsoleEvent({
            id: event.id,
            type: 'tombstone',
            text: event.text,
          });
          return;
        }

        if (event.type === 'prompt.cancel') {
          const { requestId } = event.payload as { requestId: string };
          setConsoleEvents(prev => prev.map(ev =>
            ev.promptData?.requestId === requestId
              ? { ...ev, promptData: { ...ev.promptData!, cancelled: true } }
              : ev
          ));
          if (activePromptId === requestId) {
            setActivePromptId(null);
            setInputLocked(false);
          }
          return;
        }

        if (event.type === 'quick_actions') {
          const { actions } = event.payload as { actions: QuickAction[] };
          setQuickActions(actions ?? []);
          return;
        }
      },
      onError() {
        setReconnecting(true);
        addConsoleEvent({
          id: `sys-${Date.now()}`,
          type: 'system',
          text: '-- reconnecting --',
        });
      },
    }
  );

  async function handleCancelPrompt(requestId: string) {
    try {
      await cancelPromptMutation.mutateAsync({ roomId, requestId });
    } catch {
      // Silent — UI will update when prompt.cancel event arrives via ringFeed
    }
  }

  async function handleCancelFlow() {
    try {
      await cancelFlowMutation.mutateAsync({ roomId });
      addConsoleEvent({
        id: `sys-${Date.now()}`,
        type: 'system',
        text: '-- current action cancelled --',
      });
      setActivePromptId(null);
    } catch (err) {
      addConsoleEvent({
        id: `sys-${Date.now()}`,
        type: 'system',
        text: `! ${err instanceof Error ? err.message : 'Cancel failed'}`,
      });
    } finally {
      inputRef.current?.focus();
    }
  }

  async function handleSubmitCommand(command: string) {
    if (!command.trim() || inputLocked) return;

    setInputValue('');
    setInputLocked(true);

    // Echo the command back into the feed
    addConsoleEvent({
      id: `input-${Date.now()}`,
      type: 'input',
      text: command,
    });

    try {
      const result = await sendCommand.mutateAsync({
        roomId,
        command,
        isDM: true,
      });

      if (!result.ok) {
        const msg = 'message' in result ? result.message : 'Command failed';
        addConsoleEvent({
          id: `sys-${Date.now()}`,
          type: 'system',
          text: `! ${msg}`,
        });
        // If blocked by an in-progress flow, offer a force-cancel shortcut
        if (typeof msg === 'string' && msg.includes('already in progress')) {
          addConsoleEvent({
            id: `sys-cancel-${Date.now()}`,
            type: 'system',
            text: '-- type "cancel" or click Cancel on the active prompt to abort it --',
          });
        }
      }
    } catch (err) {
      addConsoleEvent({
        id: `sys-${Date.now()}`,
        type: 'system',
        text: `! ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setInputLocked(false);
      // Return focus to input after a command
      inputRef.current?.focus();
    }
  }

  async function handleAnswer(requestId: string, answer: string) {
    // Mark the choice as selected immediately for UI feedback
    setConsoleEvents(prev => prev.map(ev =>
      ev.promptData?.requestId === requestId
        ? { ...ev, promptData: { ...ev.promptData!, selectedAnswer: answer } }
        : ev
    ));
    setActivePromptId(null);

    try {
      await respondToPrompt.mutateAsync({ roomId, requestId, answer });
    } catch {
      // Silent — the prompt is already visually resolved
    } finally {
      inputRef.current?.focus();
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(i => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = suggestionIndex >= 0 ? suggestions[suggestionIndex] : suggestions[0];
        if (target) setInputValue(target.insertValue);
        setSuggestionIndex(-1);
        return;
      }
      if (e.key === 'Escape') {
        setSuggestionIndex(-1);
        setInputValue('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setSuggestionIndex(-1);
      const trimmed = inputValue.trim().toLowerCase();
      if (trimmed === 'cancel' || trimmed === 'exit') {
        setInputValue('');
        void handleCancelFlow();
      } else {
        void handleSubmitCommand(inputValue);
      }
    }
  }

  function handleQuickAction(command: string) {
    setQuickActions([]);
    void handleSubmitCommand(command);
  }

  const placeholder = activePromptId
    ? 'Type your answer or click a choice above…'
    : inputLocked
    ? 'Sending…'
    : 'Type a command…';

  return (
    <section
      className={`terminal-pane${isActive ? ' active' : ''}`}
      aria-label="Your Console — private messages and commands"
      style={{ position: 'relative' }}
    >
      <header className="pane-header">
        <span>Console</span>
        {reconnecting && <span style={{ color: 'var(--color-accent)' }}>reconnecting…</span>}
        {activePromptId && (
          <button
            onClick={() => void handleCancelFlow()}
            style={{
              marginLeft: 'auto',
              padding: '0.1rem 0.5rem',
              fontSize: '0.75rem',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-fg-dim)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
            }}
            title="Cancel current action"
          >
            Cancel action
          </button>
        )}
      </header>

      <ol
        ref={feedRef}
        className="event-feed"
        role="log"
        aria-live="polite"
        aria-label="Console messages"
        onScroll={handleScroll}
        tabIndex={0}
      >
        {consoleEvents.length === 0 && (
          <li className="event event-system">
            <p>Type a command below to start. Try: <em>look at monsters</em></p>
          </li>
        )}
        {consoleEvents.map((ev) => {
          if (ev.type === 'prompt' && ev.promptData) {
            return (
              <li key={ev.id} className="event">
                <InlineChoices
                  requestId={ev.promptData.requestId}
                  question={ev.promptData.question}
                  choices={ev.promptData.choices}
                  selectedAnswer={ev.promptData.selectedAnswer}
                  timedOut={ev.promptData.timedOut}
                  cancelled={ev.promptData.cancelled}
                  onAnswer={handleAnswer}
                  onCancel={handleCancelPrompt}
                />
                {ev.promptData.timeoutSeconds && !ev.promptData.selectedAnswer && !ev.promptData.timedOut && !ev.promptData.cancelled && (
                  <PromptCountdown
                    arrivedAt={ev.promptData.arrivedAt}
                    timeoutSeconds={ev.promptData.timeoutSeconds}
                  />
                )}
              </li>
            );
          }
          return (
            <li key={ev.id} className={`event event-${ev.type}`}>
              <p>{ev.text}</p>
            </li>
          );
        })}
      </ol>

      {!isAtBottom && (
        <button
          className="jump-to-bottom"
          onClick={scrollToBottom}
          aria-label="Jump to latest messages"
          style={{ bottom: 'calc(var(--input-height) + 3.5rem)' }}
        >
          ↓ Latest
        </button>
      )}

      {quickActions.length > 0 && (
        <nav className="quick-actions" aria-label="Quick action suggestions">
          {quickActions.map((qa, i) => (
            <button
              key={i}
              className="quick-action-chip"
              onClick={() => handleQuickAction(qa.command)}
              title={qa.command}
            >
              {qa.label}
            </button>
          ))}
        </nav>
      )}

      <form
        className="command-dock"
        onSubmit={(e) => {
          e.preventDefault();
          setSuggestionIndex(-1);
          const trimmed = inputValue.trim().toLowerCase();
          if (trimmed === 'cancel' || trimmed === 'exit') {
            setInputValue('');
            void handleCancelFlow();
          } else {
            void handleSubmitCommand(inputValue);
          }
        }}
        aria-label="Command input"
        style={{ position: 'relative' }}
      >
        <CommandSuggestions
          suggestions={suggestions}
          activeIndex={suggestionIndex}
          onSelect={(value) => { setInputValue(value); setSuggestionIndex(-1); inputRef.current?.focus(); }}
          onDismiss={() => setSuggestionIndex(-1)}
        />
        <label htmlFor="console-input" aria-label="Command prompt">{'>'}</label>
        <input
          ref={inputRef}
          id="console-input"
          type="text"
          className="command-input"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setSuggestionIndex(-1); }}
          onKeyDown={handleInputKeyDown}
          disabled={inputLocked}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Type a command or answer"
        />
      </form>
    </section>
  );
}

function PromptCountdown({ arrivedAt, timeoutSeconds }: { arrivedAt: number; timeoutSeconds: number }) {
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Math.floor((Date.now() - arrivedAt) / 1000);
    return Math.max(0, timeoutSeconds - elapsed);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (remaining === 0) return null;

  return (
    <p
      style={{ fontSize: '0.75rem', color: remaining <= 10 ? 'var(--color-error)' : 'var(--color-fg-dim)', marginTop: '0.25rem' }}
      aria-live="off"
    >
      {remaining}s remaining
    </p>
  );
}
