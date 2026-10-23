import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {CloseIcon} from '~/components/ui/Icons';

type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Page regions made inert while a drawer is open (dialog pattern). */
const PAGE_REGIONS =
  '.announcement-bar, .site-header, #main-content, .site-footer, .dev-notice';

function getFocusable(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      element.offsetParent !== null || element === document.activeElement,
  );
}

/**
 * Slide-in drawer with overlay used for the cart, search and mobile menu.
 * Implements the modal dialog pattern: focus moves to the close button when
 * opened, Tab is trapped inside the drawer, the rest of the page is inert,
 * Escape / overlay click close it and focus returns to the element that
 * opened it.
 */
export function Aside({
  children,
  heading,
  type,
}: {
  children?: React.ReactNode;
  type: AsideType;
  heading: React.ReactNode;
}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const id = useId();
  const asideRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Keep the latest close() without re-running the effect on re-renders.
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!expanded) return;

    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const regions = Array.from(
      document.querySelectorAll<HTMLElement>(PAGE_REGIONS),
    );
    regions.forEach((region) => region.setAttribute('inert', ''));

    // `visibility` only switches once the CSS transition starts, so focus on
    // the next frame.
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    const abortController = new AbortController();
    document.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeRef.current();
          return;
        }
        if (event.key !== 'Tab' || !asideRef.current) return;
        const focusable = getFocusable(asideRef.current);
        if (!focusable.length) {
          event.preventDefault();
          closeButtonRef.current?.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        const inside =
          active instanceof Node && asideRef.current.contains(active);
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
      regions.forEach((region) => region.removeAttribute('inert'));
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [expanded]);

  return (
    <div
      aria-modal
      aria-hidden={!expanded}
      className={`overlay ${expanded ? 'expanded' : ''}`}
      role="dialog"
      aria-labelledby={id}
    >
      <button
        className="close-outside"
        onClick={close}
        aria-label="Close"
        tabIndex={-1}
      />
      <aside className={`drawer drawer--${type}`} ref={asideRef}>
        <header className="drawer__header">
          <h3 id={id} className="drawer__title">
            {heading}
          </h3>
          <button
            className="icon-btn drawer__close"
            onClick={close}
            aria-label="Close"
            ref={closeButtonRef}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
      </aside>
    </div>
  );
}

const AsideContext = createContext<AsideContextValue | null>(null);

Aside.Provider = function AsideProvider({children}: {children: ReactNode}) {
  const [type, setType] = useState<AsideType>('closed');
  const close = useCallback(() => setType('closed'), []);
  const value = useMemo(() => ({type, open: setType, close}), [type, close]);

  return (
    <AsideContext.Provider value={value}>{children}</AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}
