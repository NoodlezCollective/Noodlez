import {ContentImage} from '~/components/ContentImage';
import type {LifestyleImage} from '~/lib/content/types';

export function LifestyleGallery({images}: {images: LifestyleImage[]}) {
  if (!images.length) return null;
  return (
    <section
      className="section section--tight"
      aria-label="Life with {AppName}"
    >
      <div className="container lifestyle-grid">
        {images.slice(0, 2).map((image) => (
          <figure key={image.id}>
            <ContentImage image={image} sizes="(min-width: 48em) 50vw, 100vw" />
            {image.caption ? <figcaption>{image.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
