import {useState} from 'react';
import {Link} from 'react-router';
import {ContentImage} from '~/components/ContentImage';
import {PlayIcon} from '~/components/ui/Icons';
import {SectionHeading} from '~/components/ui/SectionHeading';
import type {UgcContent, UgcVideo} from '~/lib/content/types';
import {toEmbedUrl} from './VideoCard';

export function UgcGrid({content}: {content: UgcContent}) {
  if (!content.videos.length) return null;
  return (
    <section className="section section--tight" aria-labelledby="ugc-heading">
      <div className="container">
        <SectionHeading
          id="ugc-heading"
          title={content.heading}
          subtitle={content.subheading}
        />
        <div className="ugc-grid">
          {content.videos.map((video) => (
            <UgcCard key={video.id} video={video} />
          ))}
        </div>
      </div>
    </section>
  );
}

function UgcCard({video}: {video: UgcVideo}) {
  const [playing, setPlaying] = useState(false);
  const embedUrl = video.video?.externalUrl ? toEmbedUrl(video.video.externalUrl) : null;
  const playable = Boolean(video.video?.sources.length || embedUrl);

  const poster = video.poster ? (
    <ContentImage
      image={video.poster}
      alt={video.poster.altText ?? video.title}
      sizes="(min-width: 64em) 25vw, 50vw"
    />
  ) : null;

  if (playing && video.video?.sources.length) {
    return (
      <div className="ugc-card">
        <video controls autoPlay playsInline poster={video.poster?.url} aria-label={video.title}>
          {video.video.sources.map((source) => (
            <source key={source.url} src={source.url} type={source.mimeType} />
          ))}
          <track kind="captions" />
        </video>
      </div>
    );
  }

  if (playing && embedUrl) {
    return (
      <div className="ugc-card">
        <iframe
          src={embedUrl}
          title={video.title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          style={{position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0}}
        />
      </div>
    );
  }

  const overlay = (
    <span className="ugc-card__overlay">
      <span className="ugc-card__title">{video.title}</span>
    </span>
  );

  if (playable) {
    return (
      <button
        type="button"
        className="ugc-card"
        onClick={() => setPlaying(true)}
        aria-label={`Play video: ${video.title}`}
      >
        {poster}
        {overlay}
        <span className="ugc-card__play" aria-hidden="true">
          <PlayIcon size={40} />
        </span>
      </button>
    );
  }

  if (video.productHandle) {
    return (
      <Link
        className="ugc-card"
        to={`/products/${video.productHandle}`}
        prefetch="intent"
        aria-label={`${video.title} – shop the product`}
      >
        {poster}
        {overlay}
        <span className="ugc-card__play" aria-hidden="true">
          <PlayIcon size={40} />
        </span>
      </Link>
    );
  }

  return (
    <div className="ugc-card">
      {poster}
      {overlay}
    </div>
  );
}
