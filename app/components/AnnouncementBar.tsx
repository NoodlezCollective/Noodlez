import {useState} from 'react';
import {Marquee} from '~/components/ui/Marquee';
import {PauseToggle} from '~/components/ui/PauseToggle';

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
      <PauseToggle
        className="announcement-bar__toggle"
        label="Pause announcements"
        paused={paused}
        onToggle={() => setPaused((value) => !value)}
      />
    </div>
  );
}
