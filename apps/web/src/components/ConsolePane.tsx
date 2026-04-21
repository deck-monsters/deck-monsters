import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { GameEvent } from '@deck-monsters/server/types';

type TrackedEvent = { id: string; data: GameEvent };
import { trpc } from '../lib/trpc.js';
import { useAuth } from '../lib/auth-context.js';
import { useHandshake } from '../hooks/useHandshake.js';
import { useCommandInsert } from '../lib/command-insert-context.js';
import { useCommandAutocomplete } from '../hooks/useCommandAutocomplete.js';
import CommandSuggestions from './CommandSuggestions.js';
import InlineChoices from './InlineChoices.js';
import { formatEventText } from '../utils/format-event-text.js';
import { mapConsoleHistoryEvent } from '../utils/console-history-event-map.js';
import { useFeedAutoScroll } from '../hooks/useFeedAutoScroll.js';

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

interface PendingPromptSnapshot {
  requestId: string;
  question: string;
  choices: string[];
  timeoutSeconds?: number;
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

interface MonsterAutocompleteRow {
  name: string;
  dead: boolean;
  inRing: boolean;
  battlesTotal: number;
}

const EMPTY_MONSTERS: MonsterAutocompleteRow[] = [];
const MONSTER_REFRESH_EVENT_TYPES = new Set([
  'ring.win',
  'ring.loss',
  'ring.draw',
  'ring.fled',
  'ring.permaDeath',
]);

interface ConsolePaneProps {
  roomId: string;
  isActive: boolean;
  /** Called with each incoming private event so Terminal can track lastEventId */
  onEvent?: (event: unknown) => void;
}

function isPendingPromptSnapshot(value: unknown): value is PendingPromptSnapshot {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.requestId === 'string'
    && typeof entry.question === 'string'
    && Array.isArray(entry.choices)
    && entry.choices.every(choice => typeof choice === 'string')
    && (entry.timeoutSeconds === undefined || typeof entry.timeoutSeconds === 'number')
  );
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
  const [ftuxComplete, setFtuxComplete] = useState(false);
  const [hasFoughtFirstFight, setHasFoughtFirstFight] = useState(false);

  // Resume cursor for reconnects. Updated only on errors so we don't restart
  // the subscription on every event.
  const [subLastEventId, setSubLastEventId] = useState<string | undefined>(undefined);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenRef = useRef(new Set<string>());
  const latestTrackedEventIdRef = useRef<string | undefined>(undefined);
  const historyApplied = useRef(false);
  const previousConsoleLengthRef = useRef(0);
  const shouldScrollOnAppendRef = useRef(false);
  const autoScroll = useFeedAutoScroll();
  const ftuxStorageKey = useMemo(
    () => (user?.id ? `ftuxComplete:${user.id}` : 'ftuxComplete'),
    [user?.id]
  );

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(ftuxStorageKey) === 'true') {
      setFtuxComplete(true);
    }
  }, [ftuxStorageKey]);

  // Register command-insert function so external callers (CommandReference, etc.) can populate the input
  useEffect(() => {
    registerInsertFn((command: string) => {
      setInputValue(command);
      inputRef.current?.focus();
    });
  }, [registerInsertFn]);

  // Fetch persistent console history from DB on mount
  const { data: history } = trpc.game.consoleHistory.useQuery({ roomId });
  const { data: pendingPrompt, refetch: refetchPendingPrompt } = trpc.game.pendingPrompt.useQuery(
    { roomId },
    { enabled: !!roomId },
  );

  // Apply DB history once — pre-populate seenRef and seed stable subscription lastEventId.
  useEffect(() => {
    if (!history || historyApplied.current) return;
    historyApplied.current = true;

    // Deduplicate history by event ID (handles legacy duplicate rows in DB)
    const seen = new Set<string>();
    const dedupedHistory: typeof history = [];
    for (const ev of history) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        dedupedHistory.push(ev);
      }
    }

    const historyConsoleEvents: ConsoleEvent[] = [];
    for (const ev of dedupedHistory) {
      seenRef.current.add(ev.id);
      const consoleEv = mapConsoleHistoryEvent(ev as any);
      if (consoleEv) historyConsoleEvents.push(consoleEv);
    }

    if (historyConsoleEvents.length > 0) {
      // Merge history with any live events that arrived before history loaded.
      // Live events take priority over history events with the same ID.
      setConsoleEvents(prev => {
        const liveById = new Map(prev.map(ev => [ev.id, ev]));
        const merged: ConsoleEvent[] = historyConsoleEvents.map(
          ev => liveById.get(ev.id) ?? ev
        );
        // Append any live events not already in history (arrived after the
        // most recent history item's timestamp).
        const historyIds = new Set(historyConsoleEvents.map(ev => ev.id));
        for (const ev of prev) {
          if (!historyIds.has(ev.id)) merged.push(ev);
        }
        return merged;
      });
    }
    // Jump to bottom after history loads (instant, no animation)
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
      autoScroll.resetToBottom();
    });
  }, [history, autoScroll]);

  // Scroll to bottom when this pane becomes active (tab switch)
  useEffect(() => {
    if (isActive) {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
      setIsAtBottom(true);
      autoScroll.resetToBottom();
    }
  }, [isActive, autoScroll]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
    setIsAtBottom(true);
    autoScroll.enable();
  }, [autoScroll]);

  const { data: myMonsters, refetch: refetchMyMonsters } = trpc.game.myMonsters.useQuery(
    { roomId },
    { enabled: !!roomId },
  );
  const monsterRows = (myMonsters ?? EMPTY_MONSTERS) as MonsterAutocompleteRow[];
  const monsterNames = useMemo(
    () => monsterRows.map((m) => m.name),
    [monsterRows]
  );
  const deadMonsterNames = useMemo(
    () => monsterRows.filter((m) => m.dead).map((m) => m.name),
    [monsterRows]
  );
  const sendableMonsterNames = useMemo(
    () => monsterRows.filter((m) => !m.dead && !m.inRing).map((m) => m.name),
    [monsterRows]
  );
  const suggestions = useCommandAutocomplete(
    inputValue,
    !activePromptId && !inputLocked,
    {
      monsterNames,
      deadMonsterNames,
      sendableMonsterNames,
    }
  );
  const hasMonsters = monsterRows.length > 0;
  const hasMonsterInRing = monsterRows.some((m) => m.inRing);
  const hasDeadMonster = monsterRows.some((m) => m.dead);
  const hasBattleExperiencedMonsters = monsterRows.some((m) => m.battlesTotal > 0);
  const hasRingOutcomeHistory = useMemo(
    () => (history ?? []).some((ev) => MONSTER_REFRESH_EVENT_TYPES.has(ev.type)),
    [history]
  );
  const isEstablishedRoomState = hasBattleExperiencedMonsters || hasRingOutcomeHistory || monsterRows.length > 1;

  useEffect(() => {
    if (ftuxComplete || !isEstablishedRoomState || typeof localStorage === 'undefined') return;
    setFtuxComplete(true);
    localStorage.setItem(ftuxStorageKey, 'true');
  }, [ftuxComplete, ftuxStorageKey, isEstablishedRoomState]);

  type FtuxPhase = 'spawn' | 'equip_send' | 'waiting' | 'post_fight' | 'hidden';
  const ftuxPhase = useMemo((): FtuxPhase => {
    if (ftuxComplete) return 'hidden';
    if (!hasMonsters) return 'spawn';
    if (hasFoughtFirstFight && !hasDeadMonster) return 'hidden';
    if (hasFoughtFirstFight && hasDeadMonster) return 'post_fight';
    if (hasMonsterInRing) return 'waiting';
    return 'equip_send';
  }, [ftuxComplete, hasMonsters, hasMonsterInRing, hasFoughtFirstFight, hasDeadMonster]);

  // Monster names used by FTUX chips — pick first available in each category.
  const ftuxSendableName = sendableMonsterNames[0] ?? monsterNames.find((n) => !deadMonsterNames.includes(n)) ?? '';
  const ftuxInRingName = monsterRows.find((m) => m.inRing)?.name ?? '';
  const ftuxDeadName = deadMonsterNames[0] ?? '';
  const ftuxAction = useMemo((): { label: string; command: string } | null => {
    switch (ftuxPhase) {
      case 'spawn':
        return { label: 'spawn a monster', command: 'spawn a monster' };
      case 'equip_send':
        return ftuxSendableName
          ? { label: `equip ${ftuxSendableName}`, command: `equip ${ftuxSendableName}` }
          : { label: 'look at monsters', command: 'look at monsters' };
      case 'waiting':
        return { label: 'look at ring', command: 'look at ring' };
      case 'post_fight':
        return ftuxDeadName
          ? { label: `revive ${ftuxDeadName}`, command: `revive ${ftuxDeadName}` }
          : { label: 'look at monsters', command: 'look at monsters' };
      default:
        return null;
    }
  }, [ftuxDeadName, ftuxPhase, ftuxSendableName]);

  const sendCommand = trpc.game.command.useMutation();
  const respondToPrompt = trpc.game.respondToPrompt.useMutation();
  const cancelPromptMutation = trpc.game.cancelPrompt.useMutation();
  const cancelFlowMutation = trpc.game.cancelFlow.useMutation();

  function addConsoleEvent(ev: ConsoleEvent) {
    shouldScrollOnAppendRef.current = autoScroll.shouldFollowRef.current;
    setConsoleEvents(prev => [...prev, ev]);
  }

  useEffect(() => {
    const hasNewEvent = consoleEvents.length > previousConsoleLengthRef.current;
    if (hasNewEvent && shouldScrollOnAppendRef.current) {
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
      });
    }
    shouldScrollOnAppendRef.current = false;
    previousConsoleLengthRef.current = consoleEvents.length;
  }, [consoleEvents.length]);

  const upsertPendingPrompt = useCallback((prompt: PendingPromptSnapshot) => {
    setConsoleEvents(prev => {
      const existingIndex = prev.findIndex(ev => ev.promptData?.requestId === prompt.requestId);
      if (existingIndex === -1) {
        return [
          ...prev,
          {
            id: `prompt-resume-${prompt.requestId}`,
            type: 'prompt',
            text: prompt.question,
            promptData: {
              requestId: prompt.requestId,
              question: prompt.question,
              choices: prompt.choices,
              timedOut: false,
              cancelled: false,
              selectedAnswer: null,
              timeoutSeconds: prompt.timeoutSeconds,
              arrivedAt: Date.now(),
            },
          },
        ];
      }

      return prev.map((ev, index) => {
        if (index !== existingIndex || !ev.promptData) return ev;
        return {
          ...ev,
          text: prompt.question,
          promptData: {
            ...ev.promptData,
            question: prompt.question,
            choices: prompt.choices,
            timedOut: false,
            cancelled: false,
            selectedAnswer: null,
            timeoutSeconds: prompt.timeoutSeconds ?? ev.promptData.timeoutSeconds,
          },
        };
      });
    });
    setActivePromptId(prompt.requestId);
  }, []);

  useEffect(() => {
    if (!pendingPrompt) return;
    upsertPendingPrompt(pendingPrompt);
  }, [pendingPrompt, upsertPendingPrompt]);

  trpc.game.ringFeed.useSubscription(
    { roomId, lastEventId: subLastEventId },
    {
      onData(tracked: TrackedEvent) {
        const event = tracked.data;

        // Handshake must always be processed — signals new or reconnected subscription.
        // Must come before seenRef dedup since the server uses a stable 'handshake' ID.
        if (event.type === 'handshake') {
          handleHandshakeEvent(event);
          setReconnecting(false);
          return;
        }

        // Keep-alive ping from server — no UI action needed
        if (event.type === 'heartbeat') return;

        latestTrackedEventIdRef.current = tracked.id;

        if (seenRef.current.has(tracked.id)) return;
        seenRef.current.add(tracked.id);

        // Only process events targeted to this user
        const isPrivate = event.scope === 'private' && event.targetUserId === user?.id;
        const isPublicSystem = event.scope === 'public' && event.type === 'system';
        if (!isPrivate && !isPublicSystem) return;

        onEvent?.(event);
        if (MONSTER_REFRESH_EVENT_TYPES.has(event.type)) {
          void refetchMyMonsters();
          setHasFoughtFirstFight(true);
        }

        const payload = event.payload as Record<string, unknown>;
        if (event.type === 'system' && payload.consoleInput) {
          addConsoleEvent({
            id: event.id,
            type: 'input',
            text: event.text,
          });
          return;
        }

        if (event.type === 'system.gap') {
          addConsoleEvent({
            id: event.id,
            type: 'system',
            text: event.text,
          });
          return;
        }

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
        if (!reconnecting) {
          addConsoleEvent({
            id: `sys-${Date.now()}`,
            type: 'system',
            text: '-- reconnecting --',
          });
        }
        setReconnecting(true);
        setSubLastEventId(latestTrackedEventIdRef.current);
      },
    }
  );

  async function handleCancelPrompt(requestId: string) {
    // Optimistically hide the countdown and tombstone the prompt immediately
    setConsoleEvents(prev => prev.map(ev =>
      ev.promptData?.requestId === requestId
        ? { ...ev, promptData: { ...ev.promptData!, cancelled: true } }
        : ev
    ));
    setActivePromptId(null);
    try {
      await cancelPromptMutation.mutateAsync({ roomId, requestId });
    } catch {
      // Silent — optimistic update already applied
    }
  }

  async function handleCancelFlow() {
    // Optimistically cancel all visible unresolved prompts so countdowns hide immediately
    setConsoleEvents(prev => prev.map(ev =>
      ev.promptData && !ev.promptData.selectedAnswer && !ev.promptData.timedOut && !ev.promptData.cancelled
        ? { ...ev, promptData: { ...ev.promptData, cancelled: true } }
        : ev
    ));
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

    try {
      const result = await sendCommand.mutateAsync({
        roomId,
        command,
        isDM: true,
      });

      if (!result.ok) {
        const msg = 'message' in result ? result.message : 'Command failed';
        const blockedPrompt = 'pendingPrompt' in result && isPendingPromptSnapshot(result.pendingPrompt)
          ? result.pendingPrompt
          : null;
        addConsoleEvent({
          id: `sys-${Date.now()}`,
          type: 'system',
          text: `! ${msg}`,
        });
        if (blockedPrompt) {
          upsertPendingPrompt(blockedPrompt);
        }
        // If blocked by an in-progress flow, offer a force-cancel shortcut
        if (typeof msg === 'string' && msg.includes('already in progress')) {
          addConsoleEvent({
            id: `sys-cancel-${Date.now()}`,
            type: 'system',
            text: '-- type "cancel" or click Cancel on the active prompt to abort it --',
          });
        }
      } else {
        void refetchMyMonsters();
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
    } catch (err) {
      addConsoleEvent({
        id: `sys-${Date.now()}`,
        type: 'system',
        text: `! ${err instanceof Error ? err.message : 'Prompt is no longer active'}`,
      });
      // Recover latest pending prompt snapshot after stale requestId races.
      const latest = await refetchPendingPrompt();
      if (latest.data) {
        upsertPendingPrompt(latest.data);
      }
    } finally {
      void refetchMyMonsters();
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
      } else if (activePromptId) {
        // Route text input to the active prompt as a free-form answer
        const answer = inputValue.trim();
        setInputValue('');
        if (answer) {
          addConsoleEvent({ id: `input-${Date.now()}`, type: 'input', text: answer });
          void handleAnswer(activePromptId, answer);
        }
      } else {
        void handleSubmitCommand(inputValue);
      }
    }
  }

  function handleQuickAction(command: string) {
    setQuickActions([]);
    void handleSubmitCommand(command);
  }

  function dismissFtux() {
    setFtuxComplete(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ftuxStorageKey, 'true');
    }
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

      <Virtuoso
        ref={virtuosoRef}
        className="event-feed"
        role="log"
        aria-live="polite"
        aria-label="Console messages"
        tabIndex={0}
        data={consoleEvents}
        followOutput={false}
        components={{
          // Cast through any because Virtuoso's List type expects HTMLDivElement internally.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          List: React.forwardRef<any, any>((props, ref) => <ol {...props} ref={ref} />),
          EmptyPlaceholder: () => (
            <li className="event event-system">
              <p>Type a command below to start. Try: <em>look at monsters</em></p>
            </li>
          ),
        }}
        itemContent={(_, ev) => {
          if (ev.type === 'prompt' && ev.promptData) {
            return (
              <li className="event">
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
            <li className={`event event-${ev.type}`}>
              <div className="event-text">{formatEventText(ev.text ?? '')}</div>
            </li>
          );
        }}
        atBottomStateChange={(atBottom) => {
          setIsAtBottom(atBottom);
          autoScroll.onAtBottomChange(atBottom);
        }}
      />

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

      {ftuxPhase !== 'hidden' && (
        <section
          className="ftux-guide"
          aria-label="Getting started guide"
        >
          <button
            onClick={dismissFtux}
            aria-label="Dismiss guide"
            title="Dismiss guide"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--color-fg-dim)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0 0.25rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
          <p className="ftux-guide-copy">
            {ftuxPhase === 'spawn' && 'Welcome, Beastmaster. Spawn your first monster to begin your journey.'}
            {ftuxPhase === 'equip_send' && `Outfit ${ftuxSendableName} with cards, then send them into battle.`}
            {ftuxPhase === 'waiting' && `${ftuxInRingName} is in the ring. Fights begin once there are 2 or more monsters.`}
            {ftuxPhase === 'post_fight' && `${ftuxDeadName} has fallen. Revive them to fight again.`}
          </p>
          {ftuxAction && (
            <div className="ftux-guide-actions">
              <button className="quick-action-chip" onClick={() => handleQuickAction(ftuxAction.command)}>
                {ftuxAction.label}
              </button>
            </div>
          )}
          {ftuxPhase === 'equip_send' && (
            <p className="ftux-guide-hint">
              Once equipped, run <code>send {ftuxSendableName || '[monster]'} to the ring</code>.
            </p>
          )}
          {ftuxPhase === 'post_fight' && (
            <p className="ftux-guide-hint">
              Dead monsters can still be inspected with <code>look at monsters</code>.
            </p>
          )}
          {ftuxPhase === 'waiting' && (
            <p className="ftux-guide-hint">
              Add another monster to start fights faster.
            </p>
          )}
          {ftuxPhase === 'spawn' && (
            <p className="ftux-guide-hint">
              Need help first? Try <code>look at player handbook</code>.
            </p>
          )}
        </section>
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
          } else if (activePromptId) {
            const answer = inputValue.trim();
            setInputValue('');
            if (answer) {
              addConsoleEvent({ id: `input-${Date.now()}`, type: 'input', text: answer });
              void handleAnswer(activePromptId, answer);
            }
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
