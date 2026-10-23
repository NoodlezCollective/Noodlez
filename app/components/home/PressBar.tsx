import {ContentImage} from '~/components/ContentImage';
import {Marquee} from '~/components/ui/Marquee';
import type {PressLogo} from '~/lib/content/types';

/**
 * "As seen in" strip. Logos uploaded to Shopify render as images; otherwise a
 * typographic treatment of the publication name is used.
 */
export function PressBar({logos}: {logos: PressLogo[]}) {
  if (!logos.length) return null;
  // Repeat so the strip is wider than the viewport before the loop restarts.
  const repeats = Math.max(1, Math.ceil(12 / logos.length));
  const items = Array.from({length: repeats}).flatMap((_, repeat) =>
    logos.map((logo) => ({...logo, key: `${repeat}-${logo.id}`})),
  );
  return (
    <section className="press-bar" aria-label="As seen in">
      <Marquee duration={40} gap={0}>
        {items.map((logo) => (
          <span className="press-bar__item" key={logo.key}>
            {logo.image ? (
              <ContentImage image={logo.image} alt={logo.name} sizes="160px" />
            ) : (
              <span className={`press-logo ${pressLogoStyle(logo.name)}`}>
                {logo.name}
              </span>
            )}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

function pressLogoStyle(name: string) {
  const key = name.toLowerCase();
  if (key.includes('forbes') || key.includes('digest')) return 'press-logo--serif';
  if (key.includes('usa today')) return 'press-logo--dot press-logo--caps';
  if (key.includes('scary')) return 'press-logo--script';
  if (key.includes('us weekly')) return 'press-logo--caps';
  return '';
}
