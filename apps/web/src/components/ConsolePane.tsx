import React, { useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';

import { trpc } from '../lib/trpc.js';
import { useAuth } from '../lib/auth-context.js';
import { useGuidedStart } from '../hooks/useGuidedStart.js';
import GuidedStartBox from './GuidedStartBox.js';
import { useRingFeedListener, type TrackedRingFeedEvent } from '../hooks/useRingFeed.js';
import { useCommandInsert } from '../lib/command-insert-context.js';
import { useCommandAutocomplete, type AutocompleteSuggestion } from '../hooks/useCommandAutocomplete.js';
import { useChat } from '../hooks/useChat.js';
import {
  chatLineText,
  dmPreviewText,
  dmCandidatesOf,
  dmRest,
  isChatLine,
  orderDmSuggestions,
  resolveDmTarget,
  stillPicked,
  unreadChatLine,
  type PickedRecipient,
} from '../lib/direct-message.js';
import CommandSuggestions from './CommandSuggestions.js';
import InlineChoices from './InlineChoices.js';
import { formatEventText } from '../utils/format-event-text.js';
import { useMonsterMentions } from '../hooks/useMonsterMentions.js';
import {
  classifyHighlight,
  createDamageHistory,
  type FightHighlight,
} from '../utils/fight-highlights.js';
import FeedList from './FeedList.js';
import { mechanicKeyOf, mechanicNoteFor, mechanicPayloadOf, newestEventIdByKey } from '../lib/mechanic-notes.js';
import { mapConsoleHistoryEvent } from '../utils/console-history-event-map.js';
import { AT_BOTTOM_THRESHOLD_PX, useFeedAutoScroll } from '../hooks/useFeedAutoScroll.js';

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
  type: 'announce' | 'input' | 'system' | 'prompt' | 'tombstone' | 'highlight' | 'chat';
  text: string;
  promptData?: ActivePrompt;
  /** Set on 'highlight' rows — the tag rendered beside the line. */
  highlight?: FightHighlight;
  /** The slice of the event payload a first-time mechanic note reads (see lib/mechanic-notes.ts). */
  payload?: Record<string, unknown>;
  /** On a history line that is a question's text: the question it came from (see `feedEvents`). */
  promptRequestId?: string;
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
 * Marks every unresolved question except `keepId` cancelled. Only one question per player
 * is ever open (interactive flows run one at a time per room and user), so an older one
 * still showing live buttons when a newer one arrives is dead - its timeout/cancel event
 * never reached this Console - and its buttons would only lead to "Prompt is no longer
 * active".
 *
 * This relies on one open prompt per user (`activeFlows` plus the roomId:userId lane).
 * `cancelFlow` deletes its `activeFlows` entry early, so if a flow ever re-prompted after a
 * cancel, the retired question would stay hidden until its own timeout.
 */
function retireOtherPrompts(events: ConsoleEvent[], keepId: string): ConsoleEvent[] {
  let changed = false;
  const next = events.map(ev => {
    const p = ev.promptData;
    if (!p || p.requestId === keepId || p.selectedAnswer || p.timedOut || p.cancelled) return ev;
    changed = true;
    return { ...ev, promptData: { ...p, cancelled: true } };
  });
  return changed ? next : events;
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
  // Only the newest tagged row per mechanic may claim its note (see mechanicNoteFor).
  const newestMechanicRows = useMemo(() => newestEventIdByKey(consoleEvents), [consoleEvents]);
  /*
   * History keeps a question as a plain text line (an answered one is just a record). When the
   * Console mounts or reloads while a question is still open, that history line AND the live
   * question with its buttons both reach the feed, so the question's paragraph printed twice
   * (the shop's card and Back Room picks, guides check, roadmap 45 L1). The line is dropped
   * while a question with the same requestId is on screen; once it closes the line stays as
   * the record it is.
   */
  const feedEvents = useMemo(() => {
    const open = new Set<string>();
    for (const ev of consoleEvents) if (ev.promptData) open.add(ev.promptData.requestId);
    if (open.size === 0) return consoleEvents;
    return consoleEvents.filter(ev => !(ev.promptRequestId && open.has(ev.promptRequestId)));
  }, [consoleEvents]);
  // Per-attacker damage baseline for the "big hit" highlight. A ref, not state: it feeds
  // a classification decision and must never itself trigger a render.
  const damageHistoryRef = useRef(createDamageHistory());
  const [activePromptId, setActivePromptIdState] = useState<string | null>(null);
  const [activePromptInView, setActivePromptInView] = useState(false);
  const activePromptIdRef = useRef<string | null>(null);
  // Sets the ref synchronously too. The effect below syncs it only after a render, so a
  // prompt.request and its prompt.timeout handled in one replay burst left the Console armed
  // on a dead prompt (the timeout handler saw a null ref and never cleared it).
  const setActivePromptId = useCallback((id: string | null) => {
    activePromptIdRef.current = id;
    setActivePromptIdState(id);
  }, []);
  // requestIds resolved locally (answered, cancelled, or timed out) this session. The 3s
  // `pendingPrompt` poll can have a request already in flight when one of those happens,
  // so its response can echo the same requestId as still pending. Checked synchronously
  // at the point `upsertPendingPrompt` decides whether to (re-)arm `activePromptId` —
  // deriving this from `consoleEvents` inside a `setState` updater does not work, since
  // there is no guarantee the updater runs before the code right after the `setState`
  // call that would need to read it.
  const resolvedPromptIdsRef = useRef<Set<string>>(new Set());
  // Server time of this connection's handshake; null until one arrives.
  const connectionStartedAtRef = useRef<number | null>(null);
  const consecutiveEmptyPromptPollsRef = useRef(0);
  // When each question first reached this Console, and when the latest poll was sent: a poll
  // sent after the arrival must have seen the prompt (the server registers it before
  // publishing), so its empty answer is authoritative at once.
  const pollStartedAtRef = useRef(0);
  const promptArrivedAtRef = useRef<Map<string, number>>(new Map());
  // Supersede the question that was open when a different one arrives (see retireOtherPrompts).
  const supersedePrompt = useCallback((newId: string) => {
    const previous = activePromptIdRef.current;
    if (previous && previous !== newId) resolvedPromptIdsRef.current.add(previous);
    if (!promptArrivedAtRef.current.has(newId)) promptArrivedAtRef.current.set(newId, Date.now());
  }, []);
  const [inputValue, setInputValue] = useState('');
  // The latest input, for async code that must not overwrite what the player typed meanwhile.
  const inputValueRef = useRef('');
  inputValueRef.current = inputValue;
  const [inputLocked, setInputLocked] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  // The player picked from the `dm ` list. While the input still begins `dm {name} ` the
  // message goes to this id, never re-parsed from the text (see lib/direct-message.ts).
  const [pickedRecipient, setPickedRecipient] = useState<PickedRecipient | null>(null);

  // The prompt timeout/cancel handlers live in a subscription callback that closes over
  // the render in which it was created, so reading `activePromptId` there went stale and
  // left the input locked. They read `activePromptIdRef`, which `setActivePromptId` writes
  // synchronously (the only writer).
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenRef = useRef(new Set<string>());
  const historyApplied = useRef(false);
  const reconnectNoticeShownRef = useRef(false);
  const autoScroll = useFeedAutoScroll(virtuosoRef);
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
  // Monster sprites in place of their emoji, as in the Ring feed (roadmap 24).
  const mentions = useMonsterMentions(roomId);
  const {
    data: pendingPrompt,
    dataUpdatedAt: pendingPromptUpdatedAt,
    refetch: refetchPendingPrompt,
    isFetching: pendingPromptFetching,
  } = trpc.game.pendingPrompt.useQuery(
    { roomId },
    { enabled: !!roomId, refetchInterval: 3_000 },
  );

  useEffect(() => {
    // Date.now() is taken a few ms after the request really left, so a prompt arriving in
    // that gap could be cleared by this poll's one empty answer. That is safe only because a
    // poll-cleared prompt is NOT marked resolved (see the empty-poll effect): the next poll
    // that still lists it re-arms it. (Codex, on #422: marking it resolved here left the
    // player unable to answer until the server's timeout.)
    if (pendingPromptFetching) pollStartedAtRef.current = Date.now();
  }, [pendingPromptFetching]);

  // Scroll to bottom when this pane becomes active (tab switch)
  useEffect(() => {
    if (isActive) {
      autoScroll.snapToBottom();
      setIsAtBottom(true);
    }
  }, [isActive, autoScroll]);

  // Virtuoso reports arrival at the bottom itself; see `jumpToBottom` for why the pane no
  // longer claims it up front.
  const scrollToBottom = autoScroll.jumpToBottom;

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
  const commandSuggestions = useCommandAutocomplete(
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
  const guide = useGuidedStart(roomId);

  // Room chat (roadmap 41): shared with the Chat tab through the room's ChatProvider. The
  // Console shows only what arrives while it is mounted; the backlog belongs to the Chat tab.
  const chat = useChat();
  const { data: ringStateForDm } = trpc.game.ringState.useQuery({ roomId }, { enabled: !!roomId });
  const ringUserIds = useMemo(
    () => (ringStateForDm?.contestants ?? []).map((c) => c.userId),
    [ringStateForDm],
  );
  const dmQuery = dmRest(inputValue);
  // As a `dm ` line starts, make sure the names are current (throttled inside useChat).
  const refreshNames = chat.refreshNames;
  const typingDm = dmQuery !== null;
  useEffect(() => {
    if (typingDm) refreshNames?.();
  }, [typingDm, refreshNames]);
  const dmSuggestions = useMemo<AutocompleteSuggestion[] | null>(() => {
    if (dmQuery === null || inputLocked) return null;
    return orderDmSuggestions({
      members: chat.members,
      messages: chat.messages,
      myUserId: user?.id,
      ringUserIds,
      query: dmQuery,
    });
  }, [dmQuery, inputLocked, chat.members, chat.messages, user?.id, ringUserIds]);
  const dmCandidates = useMemo(
    () => dmCandidatesOf(chat.dmCandidates, chat.members),
    [chat.dmCandidates, chat.members],
  );
  const dmTarget = useMemo(
    () => resolveDmTarget(inputValue, dmCandidates, pickedRecipient, user?.id),
    [inputValue, dmCandidates, pickedRecipient, user?.id],
  );
  const dmPreview = dmPreviewText(dmTarget);
  // After `dm ` the list is the room's players, not commands.
  const suggestions = dmSuggestions ?? commandSuggestions;

  const sendCommand = trpc.game.command.useMutation();
  const respondToPrompt = trpc.game.respondToPrompt.useMutation();
  const cancelPromptMutation = trpc.game.cancelPrompt.useMutation();
  const cancelFlowMutation = trpc.game.cancelFlow.useMutation();

  function addConsoleEvent(ev: ConsoleEvent) {
    setConsoleEvents(prev => [...prev, ev]);
  }

  // Chat lines that arrive live. Our own send is announced both directly and by its frame, so
  // dedupe by message id.
  const shownChatIdsRef = useRef(new Set<number>());
  const liveChatShownRef = useRef(false);
  const { subscribeLive } = chat;
  useEffect(
    () =>
      subscribeLive((message) => {
        if (shownChatIdsRef.current.has(message.id)) return;
        shownChatIdsRef.current.add(message.id);
        liveChatShownRef.current = true;
        setConsoleEvents((prev) => [
          ...prev,
          { id: `chat-${message.id}`, type: 'chat', text: chatLineText(message, user?.id) },
        ]);
      }),
    [subscribeLive, user?.id],
  );

  // One line when the Console opens with unread chat. Unread loads after mount, so this waits
  // for the first non-zero count, and stays quiet if a live chat line has already shown (the
  // count would then include it).
  const unreadAnnouncedRef = useRef(false);
  useEffect(() => {
    if (unreadAnnouncedRef.current || chat.unread <= 0) return;
    unreadAnnouncedRef.current = true;
    if (liveChatShownRef.current) return;
    addConsoleEvent({ id: 'chat-unread', type: 'chat', text: unreadChatLine(chat.unread) });
  }, [chat.unread]);

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
    supersedePrompt(prompt.requestId);

    setConsoleEvents(prevAll => {
      const prev = retireOtherPrompts(prevAll, prompt.requestId);
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
  }, [supersedePrompt, setActivePromptId]);

  useEffect(() => {
    if (pendingPrompt) {
      upsertPendingPrompt(pendingPrompt);
      return;
    }

    if (!pendingPromptUpdatedAt || !activePromptIdRef.current) {
      consecutiveEmptyPromptPollsRef.current = 0;
      return;
    }

    // A cancel/timeout event can be missed during a reconnect. A prompt that has only just
    // arrived over the live feed needs two empty polls before it is cleared, so a poll that
    // was already in flight cannot erase it; if this poll was sent after the prompt arrived
    // it must have seen it, so one empty answer clears it.
    consecutiveEmptyPromptPollsRef.current += 1;
    const staleRequestId = activePromptIdRef.current;
    const arrivedAt = promptArrivedAtRef.current.get(staleRequestId);
    const old = arrivedAt !== undefined && pollStartedAtRef.current > arrivedAt;
    if (!old && consecutiveEmptyPromptPollsRef.current < 2) return;

    // Deliberately not added to resolvedPromptIdsRef. That set guards ids the player or a
    // live event settled (#153); a poll's empty answer is weaker evidence, so a later poll
    // that still lists this id must be free to re-arm it.
    setConsoleEvents(prev => prev.map(ev =>
      ev.promptData?.requestId === staleRequestId
        ? { ...ev, promptData: { ...ev.promptData, cancelled: true } }
        : ev
    ));
    setActivePromptId(null);
    setInputLocked(false);
    consecutiveEmptyPromptPollsRef.current = 0;
  }, [pendingPrompt, pendingPromptUpdatedAt, upsertPendingPrompt, setActivePromptId]);

  const onLiveEvent = useCallback((tracked: TrackedRingFeedEvent) => {
    const event = tracked.data;

    // Handshake is owned by the shared feed (protocol reload once). Pane only
    // needs to clear its reconnect notice flag when the connection recovers.
    if (event.type === 'handshake') {
      reconnectNoticeShownRef.current = false;
      // When this connection began, by the server's clock (the same clock that stamps every
      // event). Anything older than this that arrives next is replay, not news; see the
      // prompt.request branch.
      const serverTime = Date.parse(String((event.payload as { serverTime?: unknown } | undefined)?.serverTime ?? ''));
      connectionStartedAtRef.current = Number.isFinite(serverTime) ? serverTime : event.timestamp;
      return;
    }

    if (seenRef.current.has(tracked.id)) return;
    seenRef.current.add(tracked.id);

    // Only process events targeted to this user, plus the handful of public fight
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
        payload: mechanicPayloadOf(event.payload),
      });
      return;
    }

    if (!isPrivate && !isPublicSystem) return;

    if (MONSTER_REFRESH_EVENT_TYPES.has(event.type)) {
      void refetchMyMonsters();
      void refetchMyInventory();
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
        payload: mechanicPayloadOf(event.payload),
      });
      return;
    }

    if (event.type === 'prompt.request') {
      /*
       * A fresh connection (a reload, or a reconnect) replays the bus's recent events, and an
       * ANSWERED question has no closing event: answering publishes nothing, so a replayed
       * `prompt.request` looks exactly like an open one. Arming it left the Console in answer
       * mode for a question the server no longer had, so the first command after a reload was
       * sent as its answer ("Prompt is no longer active"), and the next real question then
       * retired it as "Action cancelled." (roadmap 44 K6, walk-fixes check). A request stamped
       * before this connection began is history: the `pendingPrompt` poll is what says whether
       * it is still open, and it brings the question back if so.
       */
      const startedAt = connectionStartedAtRef.current;
      if (startedAt !== null && event.timestamp < startedAt) {
        void refetchPendingPrompt();
        return;
      }
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
      supersedePrompt(promptPayload.requestId);
      setConsoleEvents(prev => [
        ...retireOtherPrompts(prev, promptPayload.requestId),
        { id: event.id, type: 'prompt', text: promptPayload.question, promptData },
      ]);
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
  }, [refetchMyMonsters, refetchMyInventory, refetchPendingPrompt, supersedePrompt, setActivePromptId, user?.id]);

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

  async function handleAnswer(requestId: string, answer: string, typed?: string) {
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
      // Only the server's own stale-prompt rejection, confirmed by a refetch that really
      // succeeded, proves the question is gone. A network failure makes react-query hand back
      // its last cached value (often null), and tombstoning then would bury a live prompt
      // for good (bug #153's reason for the delete above).
      const staleRejection = err instanceof Error
        && ((err as { data?: { code?: string } }).data?.code === 'PRECONDITION_FAILED'
          || /no longer active/i.test(err.message));
      if (latest.data) {
        upsertPendingPrompt(latest.data);
      } else if (staleRejection && latest.status === 'success') {
        // Nothing is pending: the question is gone. Without this its buttons kept
        // showing the answer as chosen (new-player walk 2, finding 9). Keep the id
        // resolved so a poll already in flight cannot re-arm it.
        resolvedPromptIdsRef.current.add(requestId);
        setConsoleEvents(prev => prev.map(ev =>
          ev.promptData?.requestId === requestId
            ? { ...ev, promptData: { ...ev.promptData!, selectedAnswer: null, cancelled: true } }
            : ev
        ));
        // Put back what was typed (unless the player has typed something newer) so one
        // more Enter runs it as a command. It is never auto-run: it may have been an answer.
        if (typed && inputValueRef.current === '') {
          inputValueRef.current = typed;
          setInputValue(typed);
        }
      }
    } finally {
      inputRef.current?.focus();
    }
  }

  /**
   * Chat typed in the Console (roadmap 41). A name picked from the `dm ` list is sent by id,
   * so it can never be re-parsed into a different player; anything else goes to `game.command`,
   * which the server catches before its flow checks, so this works with a question open and
   * leaves that question open. The typed line is not echoed: the chat line itself is the echo.
   */
  async function handleSubmitChat(line: string) {
    if (!line.trim() || inputLocked) return;
    const target = resolveDmTarget(line, dmCandidates, pickedRecipient, user?.id);
    const pickedAtSend = pickedRecipient;
    // Cleared at once so the player can carry on, and put back if the message is refused, unless
    // they have already typed something newer (as the Chat tab does).
    setInputValue('');
    inputValueRef.current = '';
    setPickedRecipient(null);
    setInputLocked(true);
    let refusal: string | null = null;
    try {
      // An empty message falls through to the server, which answers with the plan's
      // "Add a message after the name" text rather than the web repeating it.
      // A resolved player is sent BY ID, picked or typed: what the preview showed is what is
      // sent, never re-parsed on the server against a list that may have changed meanwhile
      // (the server still checks the player is a member, and refuses with "isn't in this room
      // any more"). Everything else goes to the server for its refusal text.
      if (target.kind === 'player' && target.message) {
        refusal = await chat.send(target.message, target.userId);
      } else {
        const result = await sendCommand.mutateAsync({ roomId, command: line, isDM: true });
        if (!result.ok) refusal = ('message' in result && result.message) || 'Command failed';
      }
    } catch (err) {
      refusal = err instanceof Error && err.message ? err.message : "That message didn't send. Try again.";
    } finally {
      setInputLocked(false);
    }
    if (refusal) {
      addConsoleEvent({ id: `sys-${Date.now()}`, type: 'system', text: `! ${refusal}` });
      if (inputValueRef.current === '') {
        setInputValue(line);
        if (pickedAtSend) setPickedRecipient(pickedAtSend);
      }
    }
    inputRef.current?.focus();
  }

  function submitInput() {
    setSuggestionIndex(-1);
    const trimmed = inputValue.trim().toLowerCase();
    if (trimmed === 'cancel' || trimmed === 'exit') {
      setInputValue('');
      void handleCancelFlow();
    } else if (isChatLine(inputValue, activePromptId !== null)) {
      // Before the prompt branch: chat must work while a question is open, and must not be
      // taken for its answer.
      void handleSubmitChat(inputValue);
    } else if (activePromptId) {
      // Route text input to the active prompt as a free-form answer
      const answer = inputValue.trim();
      setInputValue('');
      if (answer) {
        addConsoleEvent({ id: `input-${Date.now()}`, type: 'input', text: answer });
        void handleAnswer(activePromptId, answer, answer);
      }
    } else {
      void handleSubmitCommand(inputValue);
    }
  }

  function applySuggestion(value: string, suggestion?: AutocompleteSuggestion) {
    setInputValue(value);
    setPickedRecipient(suggestion?.userId ? { userId: suggestion.userId, name: suggestion.label } : null);
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
        if (target) applySuggestion(target.insertValue, target);
        setSuggestionIndex(-1);
        return;
      }
      if (e.key === 'Escape') {
        setSuggestionIndex(-1);
        setInputValue('');
        setPickedRecipient(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitInput();
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
        {headerActions && <span className="pane-header-actions">{headerActions}</span>}
      </header>

      {/* Gesture listeners sit on the wrapper because Virtuoso owns the scroller element;
          wheel/touch/pointer/key events bubble up from it (see useFeedAutoScroll). */}
      <div className="pane-feed-area" {...autoScroll.gestureHandlers}>
      <Virtuoso
        ref={virtuosoRef}
        scrollerRef={autoScroll.setScroller}
        className="event-feed"
        role="log"
        aria-live="polite"
        aria-label="Console messages"
        tabIndex={0}
        data={feedEvents}
        atBottomThreshold={AT_BOTTOM_THRESHOLD_PX}
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
          // No user id yet: claim nothing, or the Ring's note would be suppressed for the session.
          const mechanicNote = user?.id ? mechanicNoteFor(
                user.id,
                'console',
                ev.id,
                ev.payload,
                newestMechanicRows.get(mechanicKeyOf(ev.payload) ?? '') === ev.id,
              ) : undefined;
          const noteLine = mechanicNote ? <div className="mechanic-note">ⓘ {mechanicNote}</div> : null;
          if (ev.type === 'highlight' && ev.highlight) {
            return (
              <li className={`event event-highlight event-highlight-${ev.highlight.kind}`}>
                <span className="highlight-tag">{ev.highlight.label}</span>
                <div className="event-text">{formatEventText(ev.text ?? '', mentions)}</div>
                {noteLine}
              </li>
            );
          }
          if (ev.type === 'chat') {
            // Dimmer than announcements so a fight's narration still leads.
            return (
              <li className="event event-chat console-chat">
                <div className="event-text">{ev.text}</div>
              </li>
            );
          }
          return (
            <li className={`event event-${ev.type}`}>
              <div className="event-text">{formatEventText(ev.text ?? '', mentions)}</div>
              {noteLine}
            </li>
          );
        }}
        atBottomStateChange={(atBottom) => setIsAtBottom(autoScroll.onAtBottomChange(atBottom))}
      />

      {!isAtBottom && (
        <button
          title="Jump to the newest messages"
          className="jump-to-bottom"
          onClick={scrollToBottom}
          aria-label="Jump to latest messages"
        >
          ↓ Latest
        </button>
      )}
      </div>

      {/*
        * The chips and the getting-started guide step aside while a prompt is open: on a
        * phone they covered the question (help inventory, phone-name-covered.png). They
        * return when the prompt closes. The guide is not dismissed, only not rendered.
        */}
      {!activePromptId && quickActions.length > 0 && (
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

      {!activePromptId && guide.phase !== 'hidden' && (
        <GuidedStartBox surface="console" {...guide} onRun={handleQuickAction} />
      )}

      {/*
       * Shown only when the prompt is off-screen: the banner exists to explain a
       * prompt the player cannot see (#142). When the prompt's own choice buttons
       * are visible in the feed, this banner is redundant and covers the input on
       * a phone — the pane header's "Cancel action" button already covers that
       * case. See 10b-bugs-fixed.md #158.
       *
       * It sits in the layout above the input, not over the feed: absolutely positioned, it
       * covered the lower choices of a long prompt, which is exactly when it shows (the
       * visibility sentinel sits under the last choice). Cursor's live check, roadmap 39.
       */}
      {activePromptId && !activePromptInView && (
        <div className="command-blocked-banner" role="status">
          <span>A command is waiting for your answer. Command suggestions are paused.</span>
          <button title="Cancel current action" type="button" className="btn" onClick={() => void handleCancelFlow()}>
            Cancel action
          </button>
        </div>
      )}
      {/* A persistent live region, so the preview is announced as it changes (not only when it appears). */}
      <div aria-live="polite">
        {dmPreview && (
          <div className="dm-preview">
            {dmPreview.lead}
            {dmPreview.name !== null && <span className="dm-preview-name">{dmPreview.name}</span>}
            {dmPreview.tail}
          </div>
        )}
      </div>
      <form
        className="command-dock"
        onSubmit={(e) => {
          e.preventDefault();
          submitInput();
        }}
        aria-label="Command input"
        style={{ position: 'relative' }}
      >
        <CommandSuggestions
          suggestions={suggestions}
          activeIndex={suggestionIndex}
          onSelect={(value, suggestion) => { applySuggestion(value, suggestion); setSuggestionIndex(-1); inputRef.current?.focus(); }}
          onDismiss={() => setSuggestionIndex(-1)}
        />
        <label htmlFor="console-input" aria-label="Command prompt">{'>'}</label>
        <input
          ref={inputRef}
          id="console-input"
          type="text"
          className="command-input"
          value={inputValue}
          onChange={(e) => {
            const next = e.target.value;
            inputValueRef.current = next;
            setInputValue(next);
            setSuggestionIndex(-1);
            // Editing the picked name forgets the id: the typed text is matched afresh.
            if (pickedRecipient && !stillPicked(next, pickedRecipient)) setPickedRecipient(null);
          }}
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
