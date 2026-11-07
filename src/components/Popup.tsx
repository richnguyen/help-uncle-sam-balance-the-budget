import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * A pop-up sheet (a bottom sheet on phones): a title bar with a close button, a scrolling body,
 * and its own action row. Closes with Done, the ×, a tap outside, or Escape; focus moves in and
 * goes back where it was. Uncle Sam and the action bar step aside while it is open
 * (html.modal-open).
 */
export function Popup({ title, onClose, children, actions, className = '' }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const tid = useId();
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('[data-primary]')?.focus({ preventScroll: true });
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.documentElement.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', k); document.documentElement.classList.remove('modal-open'); back?.focus?.({ preventScroll: true }); };
  }, [onClose]);
  return createPortal(
    <div className="popup-scrim" onClick={onClose}>
      <div className={'popup' + (className ? ' ' + className : '')} role="dialog" aria-modal="true" aria-labelledby={tid} onClick={(e) => e.stopPropagation()} ref={box}>
        <div className="popup-head">
          <strong id={tid}>{title}</strong>
          <button type="button" className="popup-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="popup-body">{children}</div>
        <div className="popup-actions">
          <button type="button" className="btn btn-primary" data-primary onClick={onClose}>Done</button>
          {actions}
        </div>
      </div>
    </div>,
    document.body,
  );
}
