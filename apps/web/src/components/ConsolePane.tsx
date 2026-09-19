import React, { useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';

import { trpc } from '../lib/trpc.js';
import { useAuth } from '../lib/auth-context.js';
import { useRingFeedListener, type TrackedRingFeedEvent } from '../hooks/useRingFeed.js';
import { useCommandInsert } from '../lib/command-insert-context.js';
import { useCommandAutocomplete } from '../hooks/useCommandAutocomplete.js';
import CommandSuggestions from './CommandSuggestions.js';
import InlineChoices from './InlineChoices.js';
import { formatEventText } from '../utils/format-event-text.js';
import {
  classifyHighlight,
  createDamageHistory,
  type FightHighlight,
} from '../utils/fight-highlights.js';
import FeedList from './FeedList.js';
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
  type: 'announce' | 'input' | 'system' | 'prompt' | 'tombstone' | 'highlight';
  text: string;
  promptData?: ActivePrompt;
  /** Set on 'highlight' rows — the tag rendered beside the line. */
  highlight?: FightHighlight;
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
  inEncounter?: boolean;
}

interface InventoryAutocompleteRow {
  displayName: string;
  expired: boolean;
  usableOnMonsters: string[];
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
  headerActions?: ReactNode;
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

/**
 * Reports whether the end of the active prompt (its choice buttons) is on screen.
 * The waiting banner below the input exists for a prompt the player cannot see
 * (#142); when the choices are visible it is redundant and covers the input on a
 * phone. Virtuoso only mounts rows near the viewport, so unmounting is itself a
 * "not visible" signal; IntersectionObserver refines that for a mounted-but-scrolled
 * row. Where IntersectionObserver is unavailable, mounted counts as visible.
 */
function PromptVisibilitySentinel({ onVisibilityChange }: { onVisibilityChange: (visible: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      onVisibilityChange(true);
      return () => onVisibilityChange(false);
    }
    const observer = new IntersectionObserver(([entry]) => {
      onVisibilityChange(entry?.isIntersecting ?? false);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      onVisibilityChange(false);
    };
  }, [onVisibilityChange]);
  return <div ref={ref} aria-hidden="true" className="prompt-visibility-sentinel" style={{ height: 1 }} />;
}

export default function ConsolePane({ roomId, isActive, headerActions }: ConsolePaneProps) {
  const { user } = useAuth();
  const { registerInsertFn } = useCommandInsert();

  const [consoleEvents, setConsoleEvents] = useState<ConsoleEvent[]>([]);
  // Per-attacker damage baseline for the "big hit" highlight. A ref, not state: it feeds
  // a classification decision and must never itself trigger a render.
  const damageHistoryRef = useRef(createDamageHistory());
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [activePromptInView, setActivePromptInView] = useState(false);
  const activePromptIdRef = useRef<string | null>(null);
  // requestIds resolved locally (answered, cancelled, or timed out) this session. The 3s
  // `pendingPrompt` poll can have a request already in flight when one of those happens,
  // so its response can echo the same requestId as still pending. Checked synchronously
  // at the point `upsertPendingPrompt` decides whether to (re-)arm `activePromptId` —
  // deriving this from `consoleEvents` inside a `setState` updater does not work, since
  // there is no guarantee the updater runs before the code right after the `setState`
  // call that would need to read it.
  const resolvedPromptIdsRef = useRef<Set<string>>(new Set());
  const consecutiveEmptyPromptPollsRef = useRef(0);
  const [inputValue, setInputValue] = useState('');
  const [inputLocked, setInputLocked] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [ftuxComplete, setFtuxComplete] = useState(false);
  const [hasFoughtFirstFight, setHasFoughtFirstFight] = useState(false);

  // The prompt timeout/cancel handlers live in a subscription callback that closes over
  // the render in which it was created, so reading `activePromptId` there went stale and
  // left the input locked. Mirror it into a ref — written in an effect rather than during
  // render, so the render stays pure under StrictMode's double-invocation.
  useEffect(() => {
    activePromptIdRef.current = activePromptId;
  }, [activePromptId]);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenRef = useRef(new Set<string>());
  const historyApplied = useRef(false);
  const reconnectNoticeShownRef = useRef(false);
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
    // The unregister matters: without it a dead console's setter stays registered and
    // swallows the next quick link. See 10b-bugs-fixed.md #133.
    return registerInsertFn((command: string) => {
      if (activePromptIdRef.current) {
        addConsoleEvent({
          id: `sys-prompt-block-${Date.now()}`,
          type: 'system',
          text: '! Finish or cancel the current question before starting another command.',
        });
        return;
      }
      setInputValue(command);
      inputRef.current?.focus();
    });
  }, [registerInsertFn]);

  // Fetch persistent console history from DB on mount
  const { data: history } = trpc.game.consoleHistory.useQuery({ roomId });
  const {
    data: pendingPrompt,
    dataUpdatedAt: pendingPromptUpdatedAt,
    refetch: refetchPendingPrompt,
  } = trpc.game.pendingPrompt.useQuery(
    { roomId },
    { enabled: !!roomId, refetchInterval: 3_000 },
  );

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
  const { data: myInventory, refetch: refetchMyInventory } = trpc.game.myInventory.useQuery(
    { roomId },
    { enabled: !!roomId, staleTime: 30_000 },
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
  const transferableMonsterNames = useMemo(
    () => monsterRows.filter((m) => !m.inEncounter).map((m) => m.name),
    [monsterRows]
  );
  const characterItems = (myInventory?.items.character ?? []) as InventoryAutocompleteRow[];
  const monsterItems = (myInventory?.items.monsters ?? []) as Array<{
    monsterName: string;
    items: InventoryAutocompleteRow[];
  }>;
  const suggestions = useCommandAutocomplete(
    inputValue,
    !activePromptId && !inputLocked,
    {
      monsterNames,
      deadMonsterNames,
      sendableMonsterNames,
      transferableMonsterNames,
      characterItems,
      monsterItems,
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
    setConsoleEvents(prev => [...prev, ev]);
  }

  const upsertPendingPrompt = useCallback((prompt: PendingPromptSnapshot) => {
    consecutiveEmptyPromptPollsRef.current = 0;
    // The 3s poll can have a request in flight when the player answers, cancels, or
    // times out this exact requestId through a live event instead — the poll's response
    // then echoes the same requestId as still pending. Upserting it unconditionally used
    // to reset that resolved state back to pending, erasing the "you selected X" feedback
    // and re-arming `activePromptId`, which reopened the "waiting for your answer" banner
    // for a prompt the player was, at that moment, literally in the middle of having just
    // answered. Once a requestId is resolved locally, a stale poll for the same id must
    // not resurrect it.
    if (resolvedPromptIdsRef.current.has(prompt.requestId)) return;

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
    if (pendingPrompt) {
      upsertPendingPrompt(pendingPrompt);
      return;
    }

    if (!pendingPromptUpdatedAt || !activePromptIdRef.current) {
      consecutiveEmptyPromptPollsRef.current = 0;
      return;
    }

    // A cancel/timeout event can be missed during a reconnect. Require two authoritative
    // empty polls before clearing so an older in-flight poll cannot erase a prompt that
    // has only just arrived over the live feed.
    consecutiveEmptyPromptPollsRef.current += 1;
    if (consecutiveEmptyPromptPollsRef.current < 2) return;

    const staleRequestId = activePromptIdRef.current;
    resolvedPromptIdsRef.current.add(staleRequestId);
    setConsoleEvents(prev => prev.map(ev =>
      ev.promptData?.requestId === staleRequestId
        ? { ...ev, promptData: { ...ev.promptData, cancelled: true } }
        : ev
    ));
    setActivePromptId(null);
    setInputLocked(false);
    consecutiveEmptyPromptPollsRef.current = 0;
  }, [pendingPrompt, pendingPromptUpdatedAt, upsertPendingPrompt]);

  const onLiveEvent = useCallback((tracked: TrackedRingFeedEvent) => {
    const event = tracked.data;

    // Handshake is owned by the shared feed (protocol reload once). Pane only
    // needs to clear its reconnect notice flag when the connection recovers.
    if (event.type === 'handshake') {
      reconnectNoticeShownRef.current = false;
      return;
    }

    if (seenRef.current.has(tracked.id)) return;
    seenRef.current.add(tracked.id);

    // Only process events targeted to this user, plus the handful of public battle
    // moments worth calling out while the ring feed scrolls past. The ring pane still
    // shows everything — this is emphasis, not a second feed.
    const isPrivate = event.scope === 'private' && event.targetUserId === user?.id;
    const isPublicSystem = event.scope === 'public' && event.type === 'system';
    const fightHighlight =
      event.scope === 'public' ? classifyHighlight(event, damageHistoryRef.current) : null;

    if (fightHighlight) {
      addConsoleEvent({
        id: event.id,
        type: 'highlight',
        text: event.text ?? '',
        highlight: fightHighlight,
      });
      return;
    }

    if (!isPrivate && !isPublicSystem) return;

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
      const promptPayload = event.payload as {
        requestId: string;
        question: string;
        choices: string[];
        timeoutSeconds?: number;
      };
      const promptData: ActivePrompt = {
        requestId: promptPayload.requestId,
        question: promptPayload.question,
        choices: promptPayload.choices,
        timedOut: false,
        cancelled: false,
        selectedAnswer: null,
        timeoutSeconds: promptPayload.timeoutSeconds,
        arrivedAt: Date.now(),
      };
      addConsoleEvent({
        id: event.id,
        type: 'prompt',
        text: promptPayload.question,
        promptData,
      });
      setActivePromptId(promptPayload.requestId);
      return;
    }

    if (event.type === 'prompt.timeout') {
      const { requestId } = event.payload as { requestId: string };
      resolvedPromptIdsRef.current.add(requestId);
      setConsoleEvents(prev => prev.map(ev =>
        ev.promptData?.requestId === requestId
          ? { ...ev, promptData: { ...ev.promptData!, timedOut: true } }
          : ev
      ));
      if (activePromptIdRef.current === requestId) {
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
      resolvedPromptIdsRef.current.add(requestId);
      setConsoleEvents(prev => prev.map(ev =>
        ev.promptData?.requestId === requestId
          ? { ...ev, promptData: { ...ev.promptData!, cancelled: true } }
          : ev
      ));
      if (activePromptIdRef.current === requestId) {
        setActivePromptId(null);
        setInputLocked(false);
      }
      return;
    }

    if (event.type === 'quick_actions') {
      const { actions } = event.payload as { actions: QuickAction[] };
      setQuickActions(actions ?? []);
    }
  }, [refetchMyMonsters, user?.id]);

  const { reconnecting, seedCursor } = useRingFeedListener(onLiveEvent);

  useEffect(() => {
    if (!reconnecting) {
      reconnectNoticeShownRef.current = false;
      return;
    }
    if (reconnectNoticeShownRef.current) return;
    reconnectNoticeShownRef.current = true;
    addConsoleEvent({
      id: `sys-${Date.now()}`,
      type: 'system',
      text: '-- reconnecting --',
    });
  }, [reconnecting]);

  // Apply DB history once — pre-populate seenRef and seed shared subscription lastEventId.
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

    // Seed the shared resume cursor from history so a reconnect doesn't restart from
    // the beginning. Only when no live event has been tracked yet: history resolves
    // asynchronously, so by the time it lands the subscription may already have seen
    // newer events, and overwriting the cursor with the older history tail would make
    // the next reconnect replay everything in between (harmless thanks to seenRef,
    // but a pointless round-trip).
    if (dedupedHistory.length > 0) {
      seedCursor(dedupedHistory[dedupedHistory.length - 1]!.id);
    }

    // Jump to bottom after history loads (instant, no animation)
    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'auto' });
      autoScroll.resetToBottom();
    });
  }, [history, autoScroll, seedCursor]);

  async function handleCancelPrompt(requestId: string) {
    resolvedPromptIdsRef.current.add(requestId);
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
    const optimisticallyResolvedIds = consoleEvents
      .filter(ev => ev.promptData && !ev.promptData.selectedAnswer && !ev.promptData.timedOut && !ev.promptData.cancelled)
      .map(ev => ev.promptData!.requestId);
    for (const id of optimisticallyResolvedIds) resolvedPromptIdsRef.current.add(id);
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
      // The cancel did not actually land — the flow may still be active server-side, so
      // undo the optimistic resolution marks. A later poll must be free to re-arm it
      // rather than being blocked by our own guard while its `cancelled: true` UI state
      // (applied above) has already gone stale.
      for (const id of optimisticallyResolvedIds) resolvedPromptIdsRef.current.delete(id);
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
        void Promise.all([refetchMyMonsters(), refetchMyInventory()]);
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
    resolvedPromptIdsRef.current.add(requestId);
    // Mark the choice as selected immediately for UI feedback
    setConsoleEvents(prev => prev.map(ev =>
      ev.promptData?.requestId === requestId
        ? { ...ev, promptData: { ...ev.promptData!, selectedAnswer: answer } }
        : ev
    ));
    setActivePromptId(null);

    try {
      await respondToPrompt.mutateAsync({ roomId, requestId, answer });
      void Promise.all([refetchMyMonsters(), refetchMyInventory()]);
    } catch (err) {
      // The answer did not actually land — this requestId is not resolved after all.
      // Undo the optimistic mark so the recovery below (or a later poll) is free to
      // re-arm it as still pending instead of being silently blocked by our own guard.
      resolvedPromptIdsRef.current.delete(requestId);
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
        {headerActions && <span className="pane-header-actions">{headerActions}</span>}
      </header>

      <div className="pane-feed-area">
      <Virtuoso
        ref={virtuosoRef}
        className="event-feed"
        role="log"
        aria-live="polite"
        aria-label="Console messages"
        tabIndex={0}
        data={consoleEvents}
        /*
         * Virtuoso's own follow-output, matching RingPane. This used to be `false` with the
         * scroll driven imperatively instead: every append ran
         * `scrollToIndex({ index: 'LAST', behavior: 'smooth' })` inside a rAF. An imperative
         * smooth scroll is not cancel-aware — it keeps animating while the reader drags
         * against it, and during a fight the next event schedules another before the last
         * has landed, so the view is pulled back down over and over. That reads as a console
         * that will not scroll up at all, which is how it was reported. The ring pane, which
         * has always used `followOutput`, was never affected — Virtuoso stops following the
         * moment the reader leaves the bottom.
         *
         * `shouldFollowRef` tracks "is at bottom" and is forced true by `enable()` so a
         * command you just sent still scrolls into view. Same contract as before: follow new
         * output only when already at the bottom. See 10b-bugs-fixed.md #129.
         */
        followOutput={(atBottom) =>
          autoScroll.shouldFollowRef.current || atBottom ? 'smooth' : false
        }
        components={{
          List: FeedList,
          EmptyPlaceholder: () => (
            <li className="event event-system event-feed-empty">
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
                {ev.promptData.requestId === activePromptId && (
                  <PromptVisibilitySentinel key={ev.promptData.requestId} onVisibilityChange={setActivePromptInView} />
                )}
              </li>
            );
          }
          if (ev.type === 'highlight' && ev.highlight) {
            return (
              <li className={`event event-highlight event-highlight-${ev.highlight.kind}`}>
                <span className="highlight-tag">{ev.highlight.label}</span>
                <div className="event-text">{formatEventText(ev.text ?? '')}</div>
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
        >
          ↓ Latest
        </button>
      )}
      </div>

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
        {/*
         * Shown only when the prompt is off-screen: the banner exists to explain a
         * prompt the player cannot see (#142). When the prompt's own choice buttons
         * are visible in the feed, this banner is redundant and covers the input on
         * a phone — the pane header's "Cancel action" button already covers that
         * case. See 10b-bugs-fixed.md #156.
         */}
        {activePromptId && !activePromptInView && (
          <div className="command-blocked-banner" role="status">
            <span>A command is waiting for your answer. Command suggestions are paused.</span>
            <button type="button" className="btn" onClick={() => void handleCancelFlow()}>
              Cancel action
            </button>
          </div>
        )}
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
