import {useEffect, useRef, type RefObject} from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Elements that never render, so making them inert would be pointless. */
const NON_RENDERED = new Set([
  'SCRIPT',
  'STYLE',
  'LINK',
  'TEMPLATE',
  'NOSCRIPT',
]);

/** Tabbable, rendered elements inside `root`. */
function getFocusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      element.offsetParent !== null || element === document.activeElement,
  );
}

/**
 * Everything that is not part of `dialog`'s own branch of the document: the
 * siblings of the dialog and of each of its ancestors up to `<body>`. Making
 * these inert leaves the dialog (and anything portalled around it) usable
 * wherever it sits in the page.
 */
export function getElementsOutside(dialog: HTMLElement): HTMLElement[] {
  const outside: HTMLElement[] = [];
  let node: HTMLElement = dialog;
  while (node !== document.body && node.parentElement) {
    for (const sibling of Array.from(node.parentElement.children)) {
      if (
        sibling !== node &&
        sibling instanceof HTMLElement &&
        !NON_RENDERED.has(sibling.tagName)
      ) {
        outside.push(sibling);
      }
    }
    node = node.parentElement;
  }
  return outside;
}

export type UseModalDialogOptions = {
  /** Whether the dialog is open. Everything below only applies while it is. */
  open: boolean;
  /** Called when the user presses Escape. */
  onClose: () => void;
  /** The element Tab is trapped in (usually the one with `role="dialog"`). */
  dialogRef: RefObject<HTMLElement | null>;
  /**
   * Receives focus when the dialog opens, and when Tab has nowhere to go.
   * Defaults to the first focusable element inside the dialog.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Receives focus when the dialog closes. Defaults to the element that was
   * focused when it opened (browsers that do not focus buttons on click, such
   * as Safari, report `<body>` there, so pass the opener when it is known).
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /**
   * The elements that are made inert while the dialog is open. Defaults to
   * every element outside the dialog's own branch of the document.
   */
  getInertTargets?: (dialog: HTMLElement) => HTMLElement[];
};

/**
 * Modal dialog behaviour for drawers and sheets (the WAI-ARIA dialog
 * pattern):
 *
 * - the page behind the dialog is `inert`, so it cannot be focused, clicked
 *   or read by assistive technology;
 * - focus moves into the dialog when it opens and Tab / Shift+Tab wrap around
 *   inside it;
 * - Escape calls `onClose`;
 * - focus returns to the opener when the dialog closes.
 *
 * The component keeps rendering `role="dialog"`, `aria-modal` and the label.
 */
export function useModalDialog({
  open,
  onClose,
  dialogRef,
  initialFocusRef,
  returnFocusRef,
  getInertTargets = getElementsOutside,
}: UseModalDialogOptions): void {
  // Keep the latest callbacks without re-running the effect (which would move
  // focus again) whenever the caller re-renders with new closures.
  const onCloseRef = useRef(onClose);
  const getInertTargetsRef = useRef(getInertTargets);
  useEffect(() => {
    onCloseRef.current = onClose;
    getInertTargetsRef.current = getInertTargets;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Only undo what this dialog changed.
    const inerted = getInertTargetsRef
      .current(dialog)
      .filter((element) => !element.hasAttribute('inert'));
    inerted.forEach((element) => element.setAttribute('inert', ''));

    const focusInitial = () =>
      (initialFocusRef?.current ?? getFocusable(dialog)[0] ?? dialog).focus();

    // Drawers only become visible once their CSS transition starts, so focus
    // on the next frame.
    const frame = requestAnimationFrame(focusInitial);

    const abortController = new AbortController();
    document.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCloseRef.current();
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = getFocusable(dialog);
        if (!focusable.length) {
          event.preventDefault();
          focusInitial();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        const inside = active instanceof Node && dialog.contains(active);
        if (event.shiftKey && (!inside || active === first)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (!inside || active === last)) {
          event.preventDefault();
          first.focus();
        }
      },
      {signal: abortController.signal},
    );

    return () => {
      abortController.abort();
      cancelAnimationFrame(frame);
      inerted.forEach((element) => element.removeAttribute('inert'));
      // Read now, not when the dialog opened: the opener may have been
      // re-rendered into a new node in the meantime.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately the latest node, see above
      const target = returnFocusRef?.current ?? opener;
      if (target && document.contains(target)) target.focus();
    };
  }, [open, dialogRef, initialFocusRef, returnFocusRef]);
}
