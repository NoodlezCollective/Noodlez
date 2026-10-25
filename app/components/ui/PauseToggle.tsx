import {PlayIcon} from '~/components/ui/Icons';

/**
 * Pause/resume control for content that moves on its own (WCAG 2.2.2). The
 * label stays constant and `aria-pressed` carries the state, per the ARIA
 * toggle-button pattern.
 */
export function PauseToggle({
  paused,
  onToggle,
  label,
  className,
}: {
  paused: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={paused}
      onClick={onToggle}
    >
      {paused ? <PlayIcon size={12} /> : <PauseGlyph />}
    </button>
  );
}

/** Two bars; the shared icon set has no pause glyph. */
function PauseGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="5" y="4" width="5" height="16" rx="1.5" />
      <rect x="14" y="4" width="5" height="16" rx="1.5" />
    </svg>
  );
}
