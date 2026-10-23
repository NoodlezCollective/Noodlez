import type {CSSProperties, ReactNode} from 'react';

/**
 * Infinite horizontal scroller used for the announcement bar and press logos.
 * Content is duplicated once (aria-hidden) so the loop is seamless.
 * Respects `prefers-reduced-motion` via CSS (falls back to a static row).
 */
export function Marquee({
  children,
  duration = 40,
  gap = 48,
  className,
  pauseOnHover = true,
  label,
}: {
  children: ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  /** Gap between repeated items in px. */
  gap?: number;
  className?: string;
  pauseOnHover?: boolean;
  /** Accessible label for the region. */
  label?: string;
}) {
  const style = {
    '--marquee-duration': `${duration}s`,
    '--marquee-gap': `${gap}px`,
  } as CSSProperties;

  return (
    <div
      className={`marquee ${pauseOnHover ? 'marquee--pause' : ''} ${
        className ?? ''
      }`.trim()}
      style={style}
      aria-label={label}
      role={label ? 'region' : undefined}
    >
      <div className="marquee__track">
        <div className="marquee__group">{children}</div>
        <div className="marquee__group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
