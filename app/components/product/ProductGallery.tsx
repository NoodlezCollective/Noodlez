import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {Image} from '@shopify/hydrogen';
import {ChevronLeftIcon, ChevronRightIcon} from '~/components/ui/Icons';
import {ProductImage, type ProductImageData} from '~/components/ProductImage';

export type GalleryImage = ProductImageData & {id: string};

/** Must match the two-column breakpoint in product.css. */
const DESKTOP_MEDIA_QUERY = '(min-width: 64em)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function matches(query: string) {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

function scrollBehavior(): ScrollBehavior {
  return matches(REDUCED_MOTION_QUERY) ? 'auto' : 'smooth';
}

/** Index of the variant image inside the gallery, matched by id then by URL. */
export function findGalleryIndex(
  images: GalleryImage[],
  image?: {id?: string | null; url?: string | null} | null,
) {
  if (!image) return -1;
  const byId = image.id
    ? images.findIndex((candidate) => candidate.id === image.id)
    : -1;
  if (byId >= 0) return byId;
  if (!image.url) return -1;
  const path = image.url.split('?')[0];
  return images.findIndex((candidate) => candidate.url.split('?')[0] === path);
}

/**
 * Product media gallery.
 *
 * Desktop: one square image at a time, the track slides with a transform
 * driven by `--gallery-index` so the server render already shows the selected
 * variant's image. Mobile: a swipeable scroll-snap strip. Both have
 * previous/next buttons and a thumbnail strip.
 */
export function ProductGallery({
  images,
  selectedImageId,
  productTitle,
  className,
}: {
  images: GalleryImage[];
  /** Image id of the selected variant; the gallery follows it. */
  selectedImageId?: string | null;
  productTitle: string;
  className?: string;
}) {
  const count = images.length;
  const imageKey = images.map((image) => image.id).join('|');
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      images.findIndex((image) => image.id === selectedImageId),
    ),
  );
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  // Target of a scroll we started ourselves; scroll events are ignored until
  // the track arrives there so the smooth scroll is never re-targeted midway.
  const pendingScroll = useRef<{target: number; timer: number} | null>(null);

  const syncActiveFromScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index >= 0 && index < count) {
      setActive((current) => (current === index ? current : index));
    }
  };

  const settlePendingScroll = () => {
    if (!pendingScroll.current) return;
    window.clearTimeout(pendingScroll.current.timer);
    pendingScroll.current = null;
  };

  // Follow the selected variant's image.
  useEffect(() => {
    if (!selectedImageId) return;
    const index = imageKey.split('|').indexOf(selectedImageId);
    if (index >= 0) setActive(index);
  }, [selectedImageId, imageKey]);

  // Keep the mobile scroll-snap track aligned with the active slide.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || matches(DESKTOP_MEDIA_QUERY)) return;
    const left = active * track.clientWidth;
    if (Math.abs(track.scrollLeft - left) < 2) return;
    settlePendingScroll();
    pendingScroll.current = {
      target: left,
      // Fallback for browsers without `scrollend` or an interrupted scroll.
      timer: window.setTimeout(() => {
        pendingScroll.current = null;
        syncActiveFromScroll();
      }, 1000),
    };
    track.scrollTo({left, behavior: scrollBehavior()});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on `active` on purpose: the helpers are re-created every render and only read refs and `count` (a stale count merely bounds the index read back from the scroll position)
  }, [active]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScrollEnd = () => {
      settlePendingScroll();
      syncActiveFromScroll();
    };
    track.addEventListener('scrollend', onScrollEnd);
    return () => track.removeEventListener('scrollend', onScrollEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-attached whenever `count` changes (the track mounts when it goes 0 -> n); the handler reads only refs and `count`
  }, [count]);

  // Keep the active thumbnail visible inside the strip (horizontal only, so
  // the page never jumps).
  useEffect(() => {
    const strip = thumbsRef.current;
    const thumb = strip?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!strip || !thumb) return;
    const start = thumb.offsetLeft - strip.offsetLeft;
    const end = start + thumb.offsetWidth;
    if (start < strip.scrollLeft) {
      strip.scrollTo({left: start - 8, behavior: scrollBehavior()});
    } else if (end > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({
        left: end - strip.clientWidth + 8,
        behavior: scrollBehavior(),
      });
    }
  }, [active]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      settlePendingScroll();
    },
    [],
  );

  if (!count) {
    return (
      <div className={`gallery gallery--empty ${className ?? ''}`.trim()}>
        <ProductImage image={null} />
      </div>
    );
  }

  const go = (delta: number) =>
    setActive((index) => (index + delta + count) % count);

  // Swiping on mobile updates the active index once the scroll settles.
  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || matches(DESKTOP_MEDIA_QUERY)) return;
    const pending = pendingScroll.current;
    if (pending) {
      if (Math.abs(track.scrollLeft - pending.target) < 2)
        settlePendingScroll();
      return;
    }
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(syncActiveFromScroll);
  };

  return (
    <section
      className={`gallery ${className ?? ''}`.trim()}
      aria-roledescription="carousel"
      aria-label={`${productTitle} images`}
    >
      <div className="gallery__viewport">
        <div
          className="gallery__track"
          ref={trackRef}
          onScroll={handleScroll}
          style={{'--gallery-index': active} as CSSProperties}
        >
          {images.map((image, index) => (
            <div
              className={`gallery__slide ${
                index === active ? 'is-active' : ''
              }`.trim()}
              key={image.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}`}
            >
              <ProductImage
                image={image}
                alt={image.altText || productTitle}
                loading={index === active || index === 0 ? 'eager' : 'lazy'}
                sizes="(min-width: 64em) 600px, 100vw"
              />
            </div>
          ))}
        </div>
        {count > 1 ? (
          <>
            <button
              type="button"
              className="gallery__arrow gallery__arrow--prev"
              aria-label="Previous image"
              onClick={() => go(-1)}
            >
              <ChevronLeftIcon size={18} />
            </button>
            <button
              type="button"
              className="gallery__arrow gallery__arrow--next"
              aria-label="Next image"
              onClick={() => go(1)}
            >
              <ChevronRightIcon size={18} />
            </button>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div className="gallery__thumbs" ref={thumbsRef}>
          {images.map((image, index) => (
            <button
              type="button"
              key={image.id}
              className={`gallery__thumb ${
                index === active ? 'is-active' : ''
              }`.trim()}
              aria-label={`View image ${index + 1} of ${count}`}
              aria-pressed={index === active}
              data-index={index}
              onClick={() => setActive(index)}
            >
              <Image
                alt=""
                aspectRatio="1/1"
                data={image}
                loading="lazy"
                sizes="88px"
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
