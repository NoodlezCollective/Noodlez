import {Fragment} from 'react';
import {ContentImage} from '~/components/ContentImage';
import {Button} from '~/components/ui/Button';
import {Stars} from '~/components/ui/Stars';
import type {HeroContent} from '~/lib/content/types';

export function Hero({content}: {content: HeroContent}) {
  const lines = content.headline.split('\n').filter(Boolean);
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero__media">
        {content.image ? (
          <ContentImage
            image={content.image}
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
          />
        ) : null}
      </div>
      <div className="container">
        <div className="hero__content">
          {content.ratingLabel ? (
            <Stars rating={content.rating} label={content.ratingLabel} size="md" />
          ) : null}
          <h1 id="hero-heading" className="hero__headline">
            {lines.map((line, index) => (
              <Fragment key={line}>
                {line}
                {index < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </h1>
          <p className="hero__subheadline">{content.subheadline}</p>
          <Button to={content.cta.url} size="lg" className="hero__cta">
            {content.cta.label}
          </Button>
        </div>
      </div>
    </section>
  );
}
