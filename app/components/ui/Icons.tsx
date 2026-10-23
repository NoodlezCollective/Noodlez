import type {SVGProps} from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  /** Visible size in px (width and height). Defaults to 24. */
  size?: number;
  /** Accessible label. When omitted the icon is decorative. */
  title?: string;
};

function Svg({
  size = 24,
  title,
  children,
  strokeWidth = 1.75,
  ...props
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </Svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m15 5-7 7 7 7" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 9 7 7 7-7" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={2}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth={2.25}>
      <path d="m5 12 4.5 4.5L19 7" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </Svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.5-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" />
    </Svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M12 2.5l2.9 6.2 6.7.8-5 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7-5-4.6 6.7-.8L12 2.5Z" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.8 7.5 10 4.3-1.2 7.5-5.4 7.5-10v-6L12 2.5Z" />
    </Svg>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h9a1.5 1.5 0 0 1 1.5 1.5V8H17a2 2 0 0 1 1.6.8l2.6 3.4c.2.3.3.6.3 1V16a1.5 1.5 0 0 1-1.5 1.5h-1.3a2.75 2.75 0 0 1-5.4 0H9.2a2.75 2.75 0 0 1-5.4 0H4A1.5 1.5 0 0 1 2.5 16V6.5Zm12 3.5v3h4.4l-2.3-3h-2.1ZM6.5 16a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm9.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" />
    </Svg>
  );
}

export function SnowflakeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
      <path d="M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
    </Svg>
  );
}

export function HeatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4c-1.5 2-1.5 3.5 0 5.5s1.5 3.5 0 5.5-1.5 3.5 0 5M12 4c-1.5 2-1.5 3.5 0 5.5s1.5 3.5 0 5.5-1.5 3.5 0 5M17 4c-1.5 2-1.5 3.5 0 5.5s1.5 3.5 0 5.5-1.5 3.5 0 5" />
    </Svg>
  );
}

export function CouchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" />
      <path d="M3 13a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v5H3v-5Z" />
    </Svg>
  );
}

export function WashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="13" r="5" />
      <path d="M8 6h2M14 6h2" />
    </Svg>
  );
}

export function FeatherIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 4c-5 0-11 3-13 9l-3 7 7-3c6-2 9-8 9-13Z" />
      <path d="M4 20 13 11M8 15h5" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </Svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8" />
    </Svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14H5Z" />
      <path d="M5 19 13 11" />
    </Svg>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M6 17c-1.7 0-3-1.3-3-3s1.3-3 3-3c.2 0 .4 0 .6.1C7.3 8.6 9 7 11 6v2c-1.4.9-2.2 2-2.5 3.3.3-.2.7-.3 1-.3 1.7 0 3 1.3 3 3s-1.3 3-3 3H6Zm10 0c-1.7 0-3-1.3-3-3s1.3-3 3-3c.2 0 .4 0 .6.1.7-2.5 2.4-4.1 4.4-5.1v2c-1.4.9-2.2 2-2.5 3.3.3-.2.7-.3 1-.3 1.7 0 3 1.3 3 3s-1.3 3-3 3h-3.5Z" />
    </Svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Svg>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Svg>
  );
}

/**
 * Maps an icon key (as stored in Shopify metafields) to a feature icon.
 * Unknown keys fall back to a sparkle so content never renders without an icon.
 */
export const FEATURE_ICONS = {
  snowflake: SnowflakeIcon,
  heat: HeatIcon,
  couch: CouchIcon,
  wash: WashIcon,
  feather: FeatherIcon,
  moon: MoonIcon,
  sparkle: SparkleIcon,
  leaf: LeafIcon,
  shield: ShieldIcon,
  truck: TruckIcon,
  check: CheckIcon,
} as const;

export type FeatureIconKey = keyof typeof FEATURE_ICONS;

export function FeatureIcon({
  icon,
  ...props
}: IconProps & {icon?: string | null}) {
  const Component =
    (icon && FEATURE_ICONS[icon as FeatureIconKey]) || SparkleIcon;
  return <Component {...props} />;
}
