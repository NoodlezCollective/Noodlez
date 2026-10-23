import type {ElementType, ReactNode} from 'react';

export function Container({
  children,
  size = 'default',
  as: Tag = 'div',
  className,
  ...rest
}: {
  children: ReactNode;
  size?: 'default' | 'narrow' | 'text';
  as?: ElementType;
  className?: string;
  id?: string;
  'aria-labelledby'?: string;
}) {
  return (
    <Tag
      className={`container container--${size} ${className ?? ''}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
