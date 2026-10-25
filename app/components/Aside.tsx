import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import {CloseIcon} from '~/components/ui/Icons';
import {useModalDialog} from '~/lib/useModalDialog';

type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
};

/** Page regions made inert while a drawer is open (dialog pattern). */
const PAGE_REGIONS =
  '.announcement-bar, .site-header, #main-content, .site-footer, .dev-notice';

function getPageRegions() {
  return Array.from(document.querySelectorAll<HTMLElement>(PAGE_REGIONS));
}

/**
 * Slide-in drawer with overlay used for the cart, search and mobile menu.
 * Implements the modal dialog pattern (see `useModalDialog`): focus moves to
 * the close button when opened, Tab is trapped inside the drawer, the rest of
 * the page is inert, Escape / overlay click close it and focus returns to the
 * element that opened it.
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

  useModalDialog({
    open: expanded,
    onClose: close,
    dialogRef: asideRef,
    initialFocusRef: closeButtonRef,
    getInertTargets: getPageRegions,
  });

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
  // A drawer can open before the deferred Suspense boundaries (cart, footer)
  // have hydrated; a transition keeps React from throwing "received an update
  // before it finished hydrating" in that window.
  const open = useCallback(
    (mode: AsideType) => startTransition(() => setType(mode)),
    [],
  );
  const close = useCallback(() => open('closed'), [open]);
  const value = useMemo(() => ({type, open, close}), [type, open, close]);

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
