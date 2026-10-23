import type {CSSProperties, ReactNode} from 'react';

/**
 * Repeats of the content are decorative, so they are hidden from assistive
 * technology (`aria-hidden`) and made unreachable for the keyboard (`inert`).
 * React 18 has no `inert` prop, so it is passed through as a plain attribute.
 */
const REPEAT_ATTRIBUTES = {'aria-hidden': true, inert: ''} as const;

/**
 * Infinite horizontal scroller used for the announcement bar and press logos.
 *
 * The first copy of `children` is the only one exposed to assistive
 * technology. The track holds `copies` copies per half (so each half is wider
 * than the viewport) and a second, identical half so the loop is seamless:
 * every copy after the first is `aria-hidden` and `inert`.
 *
 * It can be paused (hover, keyboard focus inside, or the controlled `paused`
 * prop) and falls back to a static row with `prefers-reduced-motion` (see
 * app.css).
 */
export function Marquee({
  children,
  duration = 40,
  gap = 48,
  copies = 1,
  className,
  pauseOnHover = true,
  paused = false,
  label,
}: {
  children: ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  /** Gap between repeated items in px. */
  gap?: number;
  /** Copies of `children` per half of the track; raise it for short content. */
  copies?: number;
  className?: string;
  /** Pause while the pointer is over the marquee or focus is inside it. */
  pauseOnHover?: boolean;
  /** Pause the animation (for an explicit pause control). */
  paused?: boolean;
  /** Accessible label for the region. */
  label?: string;
}) {
  const style = {
    '--marquee-duration': `${duration}s`,
    '--marquee-gap': `${gap}px`,
  } as CSSProperties;
  // Copies after the first one: the rest of the first half plus the whole
  // second half.
  const repeats = Array.from(
    {length: Math.max(1, Math.floor(copies)) * 2 - 1},
    (_, repeat) => repeat + 1,
  );

  return (
    <div
      className={[
        'marquee',
        pauseOnHover ? 'marquee--pause' : '',
        paused ? 'marquee--paused' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-label={label}
      role={label ? 'region' : undefined}
    >
      <div className="marquee__track">
        <div className="marquee__group">{children}</div>
        {repeats.map((repeat) => (
          <div className="marquee__group" key={repeat} {...REPEAT_ATTRIBUTES}>
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
