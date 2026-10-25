import type {ReactNode} from 'react';

export type BadgeTone = 'accent' | 'primary' | 'neutral' | 'success';

export function Badge({
  children,
  tone = 'accent',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={`badge badge--${tone} ${className ?? ''}`.trim()}>
      {children}
    </span>
  );
}
