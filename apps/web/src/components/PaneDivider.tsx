import { useCallback, useEffect, useRef, useState } from 'react';

interface PaneDividerProps {
  onResize: (ringWidthFraction: number) => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

const MIN_PANE_WIDTH_PX = 300;

export default function PaneDivider({ onResize, containerRef }: PaneDividerProps) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startFractionRef = useRef(0.5);
  // Tracks the current fraction so keyboard steps always build on the latest position
  const currentFractionRef = useRef(0.5);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    startXRef.current = e.clientX;

    const container = containerRef.current;
    if (container) {
      const totalWidth = container.clientWidth;
      const ringPane = container.querySelector('.terminal-pane') as HTMLElement | null;
      if (ringPane) {
        const fraction = ringPane.clientWidth / totalWidth;
        startFractionRef.current = fraction;
        currentFractionRef.current = fraction;
      }
    }
  }, [containerRef]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const container = containerRef.current;
    if (!container) return;

    const totalWidth = container.clientWidth;
    const delta = e.clientX - startXRef.current;
    const newFraction = startFractionRef.current + delta / totalWidth;

    // Enforce minimum pane widths
    const minFraction = MIN_PANE_WIDTH_PX / totalWidth;
    const maxFraction = 1 - MIN_PANE_WIDTH_PX / totalWidth;
    const clamped = Math.max(minFraction, Math.min(maxFraction, newFraction));
    currentFractionRef.current = clamped;
    onResize(clamped);
  }, [dragging, containerRef, onResize]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      className={`pane-divider${dragging ? ' dragging' : ''}`}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panes"
      tabIndex={0}
      onKeyDown={(e) => {
        const step = 0.05;
        if (e.key === 'ArrowLeft') {
          const next = Math.max(0.2, currentFractionRef.current - step);
          currentFractionRef.current = next;
          onResize(next);
        }
        if (e.key === 'ArrowRight') {
          const next = Math.min(0.8, currentFractionRef.current + step);
          currentFractionRef.current = next;
          onResize(next);
        }
      }}
    >
      <div className="pane-divider-handle" aria-hidden="true">⋮</div>
    </div>
  );
}
