import React from 'react';

/**
 * The `<ol>` react-virtuoso renders inside its viewport, shared by both feeds.
 *
 * Carries `.event-feed-list`, which holds the feed's gutters. They must NOT sit on the
 * scroller (`.event-feed`): the scroller is `position: relative` and the viewport inside
 * it is `position: absolute; width: 100%`, which resolves against the padding box — so
 * padding there made every line overflow to the right, where `overflow-x: hidden` cut it
 * off. See 10b-bugs-fixed.md #98.
 *
 * Defined once at module scope. An inline component gets a fresh identity on every render,
 * which remounts the whole virtualized list and loses its scroll position.
 */
// Cast through any because Virtuoso's List type expects HTMLDivElement internally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FeedList = React.forwardRef<any, any>((props, ref) => (
  <ol {...props} ref={ref} className="event-feed-list" />
));
FeedList.displayName = 'FeedList';

export default FeedList;
