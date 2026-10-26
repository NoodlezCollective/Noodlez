import {forwardRef, type ButtonHTMLAttributes, type ReactNode} from 'react';
import {Link, type LinkProps} from 'react-router';

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'light';
export type ButtonSize = 'sm' | 'md' | 'lg';

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full width of the container. */
  block?: boolean;
  /** Shows a spinner and disables interaction. */
  loading?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    to?: undefined;
    href?: undefined;
  };

type ButtonAsLink = SharedProps &
  Omit<LinkProps, 'className' | 'children'> & {
    to: LinkProps['to'];
    href?: undefined;
  };

type ButtonAsAnchor = SharedProps &
  Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    'className' | 'children' | 'href'
  > & {
    href: string;
    to?: undefined;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsAnchor;

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className,
}: Pick<SharedProps, 'variant' | 'size' | 'block' | 'loading' | 'className'>) {
  return [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    block ? 'btn--block' : '',
    loading ? 'is-loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Pill-shaped {AppName} button. Renders a `<Link>` when `to` is provided,
 * an `<a>` when `href` is provided, otherwise a `<button>`.
 */
export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(function Button(props, ref) {
  const {variant, size, block, loading, className, children, ...rest} = props;
  const classes = buttonClassName({variant, size, block, loading, className});
  const content = (
    <>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : null}
      <span className="btn__label">{children}</span>
    </>
  );

  if ('to' in rest && rest.to !== undefined) {
    const {to, ...linkProps} = rest as ButtonAsLink;
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        to={to}
        prefetch="intent"
        {...linkProps}
      >
        {content}
      </Link>
    );
  }

  if ('href' in rest && rest.href !== undefined) {
    const {href, ...anchorProps} = rest as ButtonAsAnchor;
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        href={href}
        {...anchorProps}
      >
        {content}
      </a>
    );
  }

  const {type = 'button', disabled, ...buttonProps} = rest as ButtonAsButton;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={classes}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      {content}
    </button>
  );
});
