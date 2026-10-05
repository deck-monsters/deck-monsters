import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DetailSheetProps {
  title: string;
  /** Unique per sheet kind, for `aria-labelledby`. */
  titleId: string;
  /** The Close button's tooltip, e.g. "Close the card details". */
  closeTitle: string;
  /** The control that opened the sheet, from the click event; focus returns to it on close. */
  opener?: HTMLElement | null;
  onClose: () => void;
  children?: ReactNode;
}

/**
 * The shell shared by the Workshop's detail sheets (card details, level-up details): a bottom
 * sheet on a phone and a modest dialog on a wide screen (CSS only, `.card-detail-*`).
 *
 * Rendered in a portal on `document.body` because the Workshop sits inside terminal panes
 * whose overflow and stacking would clip a `position: fixed` child. Focus moves to Close on
 * open and returns to the control that opened it; Escape and a tap on the backdrop close it.
 */
export default function DetailSheet({ title, titleId, closeTitle, opener, onClose, children }: DetailSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The opener comes from the click event: Safari does not focus a button on tap, so
    // document.activeElement would be the body there and focus would be lost on close.
    const returnTo = opener ?? (document.activeElement as HTMLElement | null);
    closeRef.current?.focus();

    // Everything else is inert while the sheet is open, so a screen reader or Tab cannot
    // wander behind it, and the page underneath does not scroll. The sheet itself is a
    // portal on body, outside #root, so it stays live.
    const root = document.getElementById('root');
    const wasInert = root?.hasAttribute('inert') ?? false;
    root?.setAttribute('inert', '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      if (!wasInert) root?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      // The opener may have unmounted (the card moved while the sheet was open).
      if (returnTo && document.contains(returnTo)) returnTo.focus();
    };
  }, [opener]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      // Keep Tab inside the sheet: wrap between its first and last focusable controls.
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (!sheetRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="card-detail-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={sheetRef} className="card-detail-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <button
          ref={closeRef}
          type="button"
          className="btn card-detail-close"
          title={closeTitle}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
