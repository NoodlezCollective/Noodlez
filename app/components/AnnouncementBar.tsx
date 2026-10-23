import {Suspense} from 'react';
import {Await} from 'react-router';
import type {SiteSettingsQuery} from 'storefrontapi.generated';
import {Marquee} from '~/components/ui/Marquee';
import {DEFAULT_SITE_SETTINGS} from '~/lib/content/defaults';
import {mapSiteSettings} from '~/lib/content/metaobjects';

export function AnnouncementBar({
  settings,
}: {
  settings: Promise<SiteSettingsQuery | null>;
}) {
  const fallback = (
    <AnnouncementMarquee messages={DEFAULT_SITE_SETTINGS.announcements} />
  );
  return (
    <Suspense fallback={fallback}>
      <Await resolve={settings} errorElement={fallback}>
        {(data) => (
          <AnnouncementMarquee
            messages={mapSiteSettings(data?.settings?.nodes?.[0]).announcements}
          />
        )}
      </Await>
    </Suspense>
  );
}

function AnnouncementMarquee({messages}: {messages: string[]}) {
  if (!messages.length) return null;
  // Repeat the messages so the strip is wider than any viewport before it loops.
  const repeats = Math.max(1, Math.ceil(12 / messages.length));
  const items = Array.from({length: repeats}).flatMap((_, repeat) =>
    messages.map((message, index) => ({
      key: `${repeat}-${index}`,
      message,
    })),
  );
  return (
    <div className="announcement-bar" role="region" aria-label="Announcements">
      <Marquee duration={45} gap={18} pauseOnHover={false}>
        {items.map((item) => (
          <span className="announcement-bar__item" key={item.key}>
            {item.message}
          </span>
        ))}
      </Marquee>
    </div>
  );
}
