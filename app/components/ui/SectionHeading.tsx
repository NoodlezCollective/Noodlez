import type {ReactNode} from 'react';

export function SectionHeading({
  title,
  subtitle,
  align = 'center',
  as: Heading = 'h2',
  id,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'center' | 'left';
  as?: 'h1' | 'h2' | 'h3';
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`section-heading section-heading--${align} ${
        className ?? ''
      }`.trim()}
    >
      <Heading id={id} className="section-heading__title">
        {title}
      </Heading>
      {subtitle ? <p className="section-heading__subtitle">{subtitle}</p> : null}
      {children}
    </div>
  );
}
