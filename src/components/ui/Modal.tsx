import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Accessible modal dialog.
 *
 * Implemented as a positioned overlay rather than the native `<dialog>` element
 * because `showModal` behaviour is inconsistent across the test environment and
 * older browsers. The accessibility contract the native element provides is
 * reproduced explicitly: the dialog role, a modal flag, a label tied to the
 * heading, Escape to dismiss, focus moved in on open and restored on close, and
 * a click on the backdrop to dismiss.
 *
 * @param props Component props.
 * @param props.isOpen Whether the dialog is shown.
 * @param props.title Heading text, also the accessible name.
 * @param props.onClose Called when the dialog is dismissed.
 * @param props.children Dialog body.
 * @param props.actions Footer buttons.
 * @returns The dialog, or null when closed.
 */
export function Modal({
  isOpen,
  title,
  onClose,
  children,
  actions,
}: {
  isOpen: boolean;
  title: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  /* Move focus into the dialog, and restore it when the dialog closes. */
  useEffect(() => {
    if (!isOpen) return undefined;

    restoreFocusRef.current = document.activeElement;

    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? panelRef.current)?.focus();

    return () => {
      // Returning focus to the trigger is what keeps keyboard navigation from
      // jumping back to the top of the page after the dialog closes.
      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  /* Escape dismisses the dialog. */
  useEffect(() => {
    if (!isOpen) return undefined;

    /**
     * @param event Key event.
     */
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        // Only a click on the backdrop itself dismisses; a drag that started
        // inside the panel must not.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
      >
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        <div className="modal__body">{children}</div>
        <div className="modal__actions">{actions}</div>
      </div>
    </div>
  );
}
