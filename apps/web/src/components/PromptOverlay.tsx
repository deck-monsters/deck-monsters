import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc.js';

interface PendingPrompt {
  requestId: string;
  question: string;
  choices: string[];
}

/**
 * Parse labeled options from a question string of the form:
 *   "Preamble text\n\n0) Label A\n1) Label B\n2) Label C"
 *
 * Returns an array of { value, label } objects. If no labeled options are
 * found in the text, falls back to using the raw choice values as labels.
 */
function parseChoiceLabels(
  question: string,
  choices: string[],
): Array<{ value: string; label: string }> {
  const lines = question.split('\n');
  return choices.map((choice) => {
    const pattern = new RegExp(`^\\s*${choice}[).]\\s+(.+)`, 'i');
    const found = lines.find((l) => pattern.test(l));
    const match = found ? pattern.exec(found) : null;
    return { value: choice, label: match ? match[1]!.trim() : choice };
  });
}

/**
 * Strip the choices list embedded in a question string, leaving only the
 * human-readable preamble. The choices list starts after a double newline
 * followed by a line matching "N) something".
 */
function getQuestionPreamble(question: string): string {
  const parts = question.split('\n\n');
  // Keep only portions that are not purely "N) option" lists
  const preamble = parts
    .filter((part) => !/^(\s*\d+[).]\s+.+\n?)+$/.test(part.trim()))
    .join('\n\n')
    .trim();
  return preamble || question.split('\n\n')[0] || question;
}

export default function PromptOverlay() {
  const { roomId } = useParams<{ roomId?: string }>();
  const [queue, setQueue] = useState<PendingPrompt[]>([]);
  const [freeText, setFreeText] = useState('');
  const seenRef = useRef(new Set<string>());

  const respond = trpc.game.respondToPrompt.useMutation({
    onSuccess: () => {
      setQueue((prev) => prev.slice(1));
      setFreeText('');
    },
  });

  trpc.game.ringFeed.useSubscription(
    { roomId: roomId! },
    {
      enabled: !!roomId,
      onData(tracked) {
        const event = tracked.data;
        if (event.type !== 'prompt.request') return;
        const requestId = event.payload?.requestId as string | undefined;
        if (!requestId || seenRef.current.has(requestId)) return;
        seenRef.current.add(requestId);
        setQueue((prev) => [
          ...prev,
          {
            requestId,
            question: (event.payload.question as string) ?? event.text,
            choices: (event.payload.choices as string[]) ?? [],
          },
        ]);
      },
    },
  );

  const current = queue[0];
  if (!roomId || !current) return null;

  const preamble = getQuestionPreamble(current.question);
  const choiceLabels =
    current.choices.length > 0
      ? parseChoiceLabels(current.question, current.choices)
      : [];

  function handleChoiceClick(value: string) {
    if (!roomId || respond.isPending) return;
    respond.mutate({ roomId, requestId: current!.requestId, answer: value });
  }

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !freeText.trim() || respond.isPending) return;
    respond.mutate({ roomId, requestId: current!.requestId, answer: freeText.trim() });
  }

  return (
    <div className="prompt-overlay">
      <div className="prompt-panel">
        <div className="prompt-header">
          <span className="prompt-badge">Game prompt</span>
          {queue.length > 1 && (
            <span className="prompt-queue-hint">
              +{queue.length - 1} more
            </span>
          )}
        </div>

        <p className="prompt-question">{preamble}</p>

        {choiceLabels.length > 0 ? (
          <div className="prompt-choices">
            {choiceLabels.map(({ value, label }) => (
              <button
                key={value}
                className="btn prompt-choice-btn"
                onClick={() => handleChoiceClick(value)}
                disabled={respond.isPending}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleTextSubmit} className="prompt-text-form">
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Type your answer…"
              autoFocus
              disabled={respond.isPending}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={respond.isPending || !freeText.trim()}
            >
              {respond.isPending ? '…' : 'Answer'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
