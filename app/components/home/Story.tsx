import {Button} from '~/components/ui/Button';
import type {StoryContent} from '~/lib/content/types';
import {VideoCard} from './VideoCard';

export function Story({content}: {content: StoryContent}) {
  return (
    <section className="section" aria-labelledby="story-heading">
      <div className="container story">
        <div className="story__content">
          <h2 id="story-heading">{content.heading}</h2>
          <p className="story__body">{content.body}</p>
          {content.cta ? (
            <Button to={content.cta.url} variant="outline">
              {content.cta.label}
            </Button>
          ) : null}
        </div>
        <VideoCard
          video={content.video}
          title={content.heading}
          captions={content.video?.captions}
        />
      </div>
    </section>
  );
}
