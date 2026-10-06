import React from 'react';
import { formatEventText, formatLineText, type MonsterMentions } from '../utils/format-event-text.js';
import { feedBlocksOf, type FeedBlock, type FeedPart, type FeedStyle } from '../utils/feed-lines.js';

/**
 * Draws an event from its structured lines (roadmap 46a): one block per line, spacing from
 * CSS (`.feed-lines` gap), the engine's ASCII rules and fences gone. The blocks are the ones
 * `estimateFeedBlocksHeight` books, so a theme's styling here must not change a block's line
 * count or vertical chrome without going through `readFeedMetrics`.
 *
 * Card frames keep the existing `.event-card-block` panel. Millefleur draws a title line, a CSS
 * rule, then the body; the terminal themes draw the engine's own ASCII frame (rules included,
 * no title line), as Discord does. Sprites are not drawn inside a card (its columns are
 * monospace art).
 */
function renderPart(part: FeedPart, key: string, mentions?: MonsterMentions | null): React.ReactNode {
  const nodes = formatLineText(part.text, key, mentions, part.markup === true);
  if (part.strong) return <strong key={key}>{nodes}</strong>;
  if (part.danger) return <span key={key} className="feed-danger">{nodes}</span>;
  return <React.Fragment key={key}>{nodes}</React.Fragment>;
}

function FeedLineBlock({ block, mentions }: { block: FeedBlock; mentions?: MonsterMentions | null }) {
  const style = block.indent > 0 ? ({ '--feed-indent': block.indent } as React.CSSProperties) : undefined;
  if (block.card) {
    return (
      <div className="feed-line feed-line-card event-card-block" data-kind="card">
        {block.card.title && <div className="feed-card-title">{block.card.title}</div>}
        {block.card.body && <div className="feed-card-body">{block.card.body}</div>}
      </div>
    );
  }
  const children = block.parts.map((part, i) => renderPart(part, `${block.key}-${i}`, mentions));
  if (block.divider) {
    return (
      <div className="feed-line feed-divider" data-kind={block.kind}>
        <span>{children}</span>
      </div>
    );
  }
  return (
    <div
      className={`feed-line feed-line-${block.kind}`}
      data-kind={block.kind}
      data-boss={block.boss ? '' : undefined}
      style={style}
    >
      {children}
    </div>
  );
}

export default function FeedLines({ blocks, mentions }: { blocks: readonly FeedBlock[]; mentions?: MonsterMentions | null }) {
  return (
    <div className="feed-lines">
      {blocks.map((block) => (
        <FeedLineBlock key={block.key} block={block} mentions={mentions} />
      ))}
    </div>
  );
}

/** An event's body: its structured lines when it has them, else its text exactly as before. */
export function FeedEventBody({
  text,
  payload,
  style,
  mentions,
}: {
  text: string;
  payload: unknown;
  style: FeedStyle;
  mentions?: MonsterMentions | null;
}) {
  const blocks = feedBlocksOf(payload, style);
  return blocks ? <FeedLines blocks={blocks} mentions={mentions} /> : <>{formatEventText(text, mentions)}</>;
}
