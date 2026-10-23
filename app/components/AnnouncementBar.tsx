import {useState} from 'react';
import {PlayIcon} from '~/components/ui/Icons';
import {Marquee} from '~/components/ui/Marquee';

/**
 * Scrolling announcement strip. The messages are read once (the Marquee hides
 * its repeats from assistive technology). Because the text moves on its own,
 * WCAG 2.2.2 requires a way to stop it: it pauses while hovered or while focus
 * is inside the bar, stays still with `prefers-reduced-motion`, and the
 * toggle button pauses it for good.
 */
export function AnnouncementBar({messages}: {messages: string[]}) {
  const [paused, setPaused] = useState(false);
  if (!messages.length) return null;
  // Repeat the messages so each half of the loop is wider than any viewport.
  const copies = Math.max(1, Math.ceil(12 / messages.length));
  const items = messages.map((message, index) => ({
    key: `${index}-${message}`,
    message,
  }));
  return (
    <div className="announcement-bar" role="region" aria-label="Announcements">
      <Marquee duration={45} gap={18} copies={copies} paused={paused}>
        {items.map((item) => (
          <span className="announcement-bar__item" key={item.key}>
            {item.message}
          </span>
        ))}
      </Marquee>
      <button
        type="button"
        className="announcement-bar__toggle"
        aria-label="Pause announcements"
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <PlayIcon size={12} /> : <PauseGlyph />}
      </button>
    </div>
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
