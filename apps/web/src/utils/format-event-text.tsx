import React from 'react';

/**
 * Splits event text on triple-backtick boundaries and renders backtick-enclosed
 * segments as styled card panels. Plain segments are rendered as spans.
 *
 * The engine uses ``` blocks for Slack monospace formatting; on the web we
 * convert them to a visually distinct `.event-card-block` panel instead.
 */
export function formatEventText(text: string): React.ReactNode {
	const parts = text.split('```');

	return parts.map((part, i) => {
		const isBlock = i % 2 === 1;
		if (!part) return null;

		if (isBlock) {
			return (
				<div key={i} className="event-card-block">
					{part}
				</div>
			);
		}

		return <span key={i}>{part}</span>;
	});
}
