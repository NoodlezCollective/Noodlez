import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import * as IconModule from './Icons';
import {
  FEATURE_ICONS,
  FeatureIcon,
  SparkleIcon,
  isFeatureIconKey,
} from './Icons';

function render(icon: string | null | undefined) {
  return renderToStaticMarkup(<FeatureIcon icon={icon} size={20} />);
}

const SPARKLE = renderToStaticMarkup(<SparkleIcon size={20} />);

/** Names every plain object inherits; none of them is an icon. */
const INHERITED_NAMES = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  '__proto__',
  '__defineGetter__',
  '__lookupGetter__',
];

describe('isFeatureIconKey', () => {
  it.each(Object.keys(FEATURE_ICONS))('accepts the icon "%s"', (key) => {
    expect(isFeatureIconKey(key)).toBe(true);
  });

  it.each(INHERITED_NAMES)('rejects the inherited name "%s"', (name) => {
    expect(isFeatureIconKey(name)).toBe(false);
  });

  it.each([
    ['an unknown key', 'rocket'],
    ['an empty string', ''],
    ['different casing', 'Snowflake'],
    ['padding', ' snowflake '],
    ['undefined', undefined],
    ['null', null],
    ['a number', 1],
    ['an object', {}],
    ['an array', ['snowflake']],
  ])('rejects %s', (_label, value) => {
    expect(isFeatureIconKey(value)).toBe(false);
  });
});

describe('FeatureIcon', () => {
  it.each(Object.keys(FEATURE_ICONS))('renders the "%s" icon', (key) => {
    // Act
    const html = render(key);

    // Assert
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toContain('width="20"');
  });

  it.each(Object.keys(FEATURE_ICONS).filter((key) => key !== 'sparkle'))(
    'renders the "%s" icon rather than the fallback',
    (key) => {
      expect(render(key)).not.toBe(SPARKLE);
    },
  );

  it.each(INHERITED_NAMES)(
    'falls back to the sparkle icon for the inherited name "%s"',
    (name) => {
      // Arrange + Act
      const html = render(name);

      // Assert: renders (no SSR crash, no "[object Undefined]") as a sparkle.
      expect(html).toBe(SPARKLE);
      expect(html).not.toContain('[object');
    },
  );

  it.each([
    ['an unknown key', 'rocket'],
    ['an empty key', ''],
    ['a missing key', undefined],
    ['a null key', null],
  ])('falls back to the sparkle icon for %s', (_label, icon) => {
    expect(render(icon)).toBe(SPARKLE);
  });

  it('forwards size and title to the icon', () => {
    const html = renderToStaticMarkup(
      <FeatureIcon icon="moon" size={32} title="Sleeps well" />,
    );

    expect(html).toContain('width="32"');
    expect(html).toContain('<title>Sleeps well</title>');
    expect(html).toContain('role="img"');
  });
});

type IconComponent = (props: {
  size?: number;
  title?: string;
}) => React.JSX.Element;

describe('every icon component', () => {
  const icons = Object.entries(IconModule).filter(
    (entry): entry is [string, IconComponent] =>
      entry[0].endsWith('Icon') && typeof entry[1] === 'function',
  );

  it('covers the whole icon set', () => {
    expect(icons.length).toBeGreaterThanOrEqual(25);
  });

  it.each(icons)('%s is a decorative svg by default', (_name, Icon) => {
    const html = renderToStaticMarkup(<Icon />);

    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toContain('width="24"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it.each(icons)('%s honours size and an accessible title', (_name, Icon) => {
    const html = renderToStaticMarkup(<Icon size={40} title="Label" />);

    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
    expect(html).toContain('role="img"');
    expect(html).toContain('<title>Label</title>');
    expect(html).not.toContain('aria-hidden');
  });
});
