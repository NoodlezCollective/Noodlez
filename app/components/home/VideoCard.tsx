import {useEffect, useRef, useState} from 'react';
import {ContentImage} from '~/components/ContentImage';
import {PlayIcon} from '~/components/ui/Icons';
import type {VideoContent, VideoCaptions} from '~/lib/content/types';

export function toEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}?autoplay=1&rel=0`;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const id =
        parsed.searchParams.get('v') ?? parsed.pathname.split('/').pop();
      return id
        ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
        : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export type {VideoCaptions};

/** The `<track>` for a captions file; rendered only when one is provided. */
export function CaptionsTrack({captions}: {captions?: VideoCaptions | null}) {
  if (!captions) return null;
  return (
    <track
      kind="captions"
      src={captions.url}
      srcLang={captions.language ?? 'en'}
      label={captions.label ?? 'English'}
    />
  );
}

/**
 * 16:9 video card. Shows the poster with a play button; on play it renders a
 * native <video> for Shopify-hosted sources or an iframe for YouTube/Vimeo
 * and moves focus to it (the play button it replaces held the focus).
 * Without any playable source the poster is shown without a dead control.
 * A captions track is only offered when `captions` is provided.
 */
export function VideoCard({
  video,
  title,
  className,
  captions,
}: {
  video: VideoContent | null;
  title: string;
  className?: string;
  captions?: VideoCaptions | null;
}) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const embedUrl = video?.externalUrl ? toEmbedUrl(video.externalUrl) : null;
  const playable = Boolean(video?.sources.length || embedUrl);

  // The play button unmounts when playback starts, which would drop keyboard
  // focus to <body>: hand it to the player instead.
  useEffect(() => {
    if (playing) (videoRef.current ?? frameRef.current)?.focus();
  }, [playing]);

  return (
    <div className={`video-card ${className ?? ''}`.trim()}>
      {playing && video?.sources.length ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- merchant-supplied videos ship no caption track; one is rendered below whenever `captions` is provided
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          poster={video.poster?.url}
          aria-label={title}
        >
          {video.sources.map((source) => (
            <source key={source.url} src={source.url} type={source.mimeType} />
          ))}
          <CaptionsTrack captions={captions} />
        </video>
      ) : playing && embedUrl ? (
        <iframe
          ref={frameRef}
          src={embedUrl}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <>
          {video?.poster ? (
            <ContentImage
              image={video.poster}
              alt={video.poster.altText ?? title}
              sizes="(min-width: 64em) 50vw, 100vw"
            />
          ) : null}
          {playable ? (
            <button
              type="button"
              className="video-card__play"
              onClick={() => setPlaying(true)}
              aria-label={`Play video: ${title}`}
            >
              <span className="video-card__play-icon">
                <PlayIcon size={30} />
              </span>
            </button>
          ) : !video?.poster ? (
            <p className="video-card__placeholder">
              Add a video to the “{title}” story in Shopify to play it here.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
