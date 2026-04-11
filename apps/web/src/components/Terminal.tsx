import { useCallback, useEffect, useRef, useState } from 'react';
import RingPane from './RingPane.js';
import ConsolePane from './ConsolePane.js';
import PaneDivider from './PaneDivider.js';
import CatchUpBanner from './CatchUpBanner.js';

type TabId = 'ring' | 'console';

interface TerminalProps {
  roomId: string;
}

export default function Terminal({ roomId }: TerminalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('console');
  const [isSideBySide, setIsSideBySide] = useState(false);
  const [ringWidthFraction, setRingWidthFraction] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect layout breakpoint
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setIsSideBySide(entry.contentRect.width >= 1024);
      }
    });

    const container = containerRef.current;
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl+1 = Ring, Cmd/Ctrl+2 = Console
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setActiveTab('ring');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        setActiveTab('console');
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleTabSwitch = useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  const handleResize = useCallback((fraction: number) => {
    setRingWidthFraction(fraction);
    if (containerRef.current) {
      containerRef.current.style.setProperty(
        '--ring-pane-width',
        `${(fraction * 100).toFixed(1)}%`
      );
    }
  }, []);

  const handleEvent = useCallback((_event: unknown) => {
    // Future: track lastEventId across both panes for reconnect
  }, []);

  return (
    <div
      ref={containerRef}
      className="terminal-shell"
      data-layout={isSideBySide ? 'side-by-side' : 'tabbed'}
    >
      {/* Tab bar — only visible on narrow screens */}
      <CatchUpBanner roomId={roomId} />

      {!isSideBySide && (
        <div className="terminal-tabs" role="tablist" aria-label="Switch panes">
          <button
            className={`terminal-tab${activeTab === 'ring' ? ' active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'ring'}
            aria-controls="pane-ring"
            id="tab-ring"
            onClick={() => handleTabSwitch('ring')}
          >
            The Ring
          </button>
          <button
            className={`terminal-tab${activeTab === 'console' ? ' active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'console'}
            aria-controls="pane-console"
            id="tab-console"
            onClick={() => handleTabSwitch('console')}
          >
            Console
          </button>
        </div>
      )}

      <RingPane
        roomId={roomId}
        isActive={isSideBySide || activeTab === 'ring'}
        onEvent={handleEvent}
      />

      {isSideBySide && (
        <PaneDivider
          onResize={handleResize}
          containerRef={containerRef}
        />
      )}

      <ConsolePane
        roomId={roomId}
        isActive={isSideBySide || activeTab === 'console'}
        onEvent={handleEvent}
      />
    </div>
  );
}
