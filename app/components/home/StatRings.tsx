import {useEffect, useRef, useState} from 'react';
import type {ProofStat} from '~/lib/content/types';

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DURATION = 1400;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Three percentage rings that count up when scrolled into view:
 * "95% sleep at their ideal temperature". The numbers render complete on the
 * server (and under reduced motion) so the proof is never missing from the
 * first paint; only the count-up is progressive.
 */
export function StatRings({
  stats,
  heading = 'Sleepers who switched',
  className,
}: {
  stats: ProofStat[];
  heading?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        setProgress(0);
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION);
          // ease-out cubic
          setProgress(1 - Math.pow(1 - t, 3));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      {threshold: 0.4},
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  if (!stats.length) return null;

  return (
    <section
      className={`section section--tight stat-rings ${className ?? ''}`.trim()}
      aria-labelledby="stat-rings-heading"
      ref={ref}
    >
      <div className="container">
        <h2 id="stat-rings-heading" className="stat-rings__heading">
          {heading}
        </h2>
        <ul className="stat-rings__list">
          {stats.map((stat) => {
            const shown = Math.round(stat.value * progress);
            const dash = CIRCUMFERENCE * (1 - (stat.value * progress) / 100);
            return (
              <li className="stat-ring" key={stat.id}>
                <svg
                  className="stat-ring__svg"
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                >
                  <circle
                    className="stat-ring__track"
                    cx="50"
                    cy="50"
                    r={RADIUS}
                  />
                  <circle
                    className="stat-ring__fill"
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={dash}
                  />
                </svg>
                <span className="stat-ring__value" aria-hidden="true">
                  {shown}%
                </span>
                <p className="stat-ring__label">
                  <span className="sr-only">{stat.value}% </span>
                  {stat.label}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
