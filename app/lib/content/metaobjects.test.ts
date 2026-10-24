import type {
  AboutContentQuery,
  HomeContentQuery,
  MellowMetaobjectFragment,
} from 'storefrontapi.generated';
import {describe, expect, it} from 'vitest';
import {FEATURE_ICONS} from '~/components/ui/Icons';
import {
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_HOME_CONTENT,
  DEFAULT_SITE_SETTINGS,
} from './defaults';
import {
  fieldCollectionHandle,
  fieldImage,
  fieldLink,
  fieldList,
  fieldNumber,
  fieldProductHandle,
  fieldText,
  fieldUrl,
  fieldVideo,
  mapAboutContent,
  mapHomeContent,
  mapSiteSettings,
  toRecord,
} from './metaobjects';

type FieldInput = string | null | {value?: string | null; reference?: unknown};

/** Builds a metaobject node the way the Storefront API returns it. */
function metaobject(
  fields: Record<string, FieldInput>,
  id = 'gid://shopify/Metaobject/1',
): MellowMetaobjectFragment {
  return {
    id,
    handle: id.split('/').pop() ?? id,
    type: 'mellow_test',
    fields: Object.entries(fields).map(([key, input]) => {
      const object = typeof input === 'object' && input !== null ? input : null;
      return {
        key,
        type: 'single_line_text_field',
        value: object ? (object.value ?? null) : input,
        reference: object?.reference ?? null,
      };
    }),
  } as unknown as MellowMetaobjectFragment;
}

function record(fields: Record<string, FieldInput>) {
  return toRecord(metaobject(fields));
}

const list = (...entries: string[]) => JSON.stringify(entries);

function homeQuery(
  parts: Partial<Record<keyof HomeContentQuery, MellowMetaobjectFragment[]>>,
): HomeContentQuery {
  const keys: Array<keyof HomeContentQuery> = [
    'settings',
    'hero',
    'pressLogos',
    'story',
    'ugcVideos',
    'lifestyle',
    'testimonials',
    'faqs',
  ];
  return Object.fromEntries(
    keys.map((key) => [key, {nodes: parts[key] ?? []}]),
  ) as unknown as HomeContentQuery;
}

function aboutQuery(nodes: MellowMetaobjectFragment[]): AboutContentQuery {
  return {about: {nodes}} as unknown as AboutContentQuery;
}

const UNSAFE_URLS = [
  'javascript:alert(1)',
  ' JavaScript:alert(document.cookie)',
  'java\tscript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
];

describe('field readers', () => {
  it('fieldText returns the value and treats blank values as missing', () => {
    const r = record({a: 'Hello', b: '   ', c: '', d: null});

    expect(fieldText(r, 'a')).toBe('Hello');
    expect(fieldText(r, 'b')).toBeNull();
    expect(fieldText(r, 'c')).toBeNull();
    expect(fieldText(r, 'd')).toBeNull();
    expect(fieldText(r, 'missing')).toBeNull();
    expect(fieldText(null, 'a')).toBeNull();
  });

  it('fieldNumber reads finite numbers only', () => {
    const r = record({a: '4.5', b: 'abc', c: 'Infinity'});

    expect(fieldNumber(r, 'a')).toBe(4.5);
    expect(fieldNumber(r, 'b')).toBeNull();
    expect(fieldNumber(r, 'c')).toBeNull();
    expect(fieldNumber(r, 'missing')).toBeNull();
  });

  it('fieldList reads a JSON list or plain lines', () => {
    expect(fieldList(record({a: list('x', 'y')}), 'a')).toEqual(['x', 'y']);
    expect(fieldList(record({a: 'x\ny'}), 'a')).toEqual(['x', 'y']);
    expect(fieldList(record({}), 'a')).toEqual([]);
  });
});

const mediaImage = (url: string, altText: string | null = 'Alt') => ({
  __typename: 'MediaImage',
  id: 'gid://shopify/MediaImage/1',
  image: {url, altText, width: 800, height: 600},
});

const video = (
  sources: Array<{url: string; mimeType: string}>,
  preview?: string,
) => ({
  __typename: 'Video',
  id: 'gid://shopify/Video/1',
  sources,
  previewImage: preview
    ? {url: preview, altText: null, width: 640, height: 360}
    : null,
});

describe('reference readers', () => {
  describe('fieldImage', () => {
    it('reads a media image', () => {
      const r = record({
        image: {reference: mediaImage('https://cdn.example/a.jpg')},
      });

      expect(fieldImage(r, 'image')).toEqual({
        url: 'https://cdn.example/a.jpg',
        altText: 'Alt',
        width: 800,
        height: 600,
      });
    });

    it('turns a missing alt text into null', () => {
      const r = record({
        image: {reference: mediaImage('https://cdn.example/a.jpg', null)},
      });

      expect(fieldImage(r, 'image')?.altText).toBeNull();
    });

    it('uses the preview image of a video', () => {
      const r = record({
        image: {reference: video([], 'https://cdn.example/preview.jpg')},
      });

      expect(fieldImage(r, 'image')?.url).toBe(
        'https://cdn.example/preview.jpg',
      );
    });

    it('accepts an uploaded file when it is an image', () => {
      const r = record({
        image: {
          reference: {
            __typename: 'GenericFile',
            id: 'f',
            url: 'https://cdn.example/f.png',
            mimeType: 'image/png',
          },
        },
      });

      expect(fieldImage(r, 'image')).toEqual({
        url: 'https://cdn.example/f.png',
        altText: null,
      });
    });

    it.each([
      [
        'a PDF file',
        {
          __typename: 'GenericFile',
          id: 'f',
          url: 'https://x/f.pdf',
          mimeType: 'application/pdf',
        },
      ],
      ['a product', {__typename: 'Product', id: 'p', handle: 'h', title: 'T'}],
      [
        'a media image without a URL',
        {__typename: 'MediaImage', id: 'm', image: null},
      ],
      ['nothing', null],
    ])('returns null for %s', (_label, reference) => {
      expect(fieldImage(record({image: {reference}}), 'image')).toBeNull();
      expect(fieldImage(null, 'image')).toBeNull();
    });
  });

  describe('fieldVideo', () => {
    it('reads the sources of an uploaded video with its preview as poster', () => {
      const r = record({
        video: {
          reference: video(
            [{url: 'https://cdn.example/v.mp4', mimeType: 'video/mp4'}],
            'https://cdn.example/preview.jpg',
          ),
        },
      });

      expect(fieldVideo(r, 'video')).toEqual({
        sources: [{url: 'https://cdn.example/v.mp4', mimeType: 'video/mp4'}],
        poster: {
          url: 'https://cdn.example/preview.jpg',
          altText: null,
          width: 640,
          height: 360,
        },
        externalUrl: null,
      });
    });

    it('prefers an explicit poster over the video preview', () => {
      const r = record({
        video: {
          reference: video(
            [{url: 'https://cdn.example/v.mp4', mimeType: 'video/mp4'}],
            'https://cdn.example/preview.jpg',
          ),
        },
        poster: {reference: mediaImage('https://cdn.example/poster.jpg')},
      });

      expect(fieldVideo(r, 'video')?.poster?.url).toBe(
        'https://cdn.example/poster.jpg',
      );
    });

    it('falls back to an external video URL', () => {
      const r = record({
        video: null,
        video_url: 'https://youtu.be/abc123',
        poster: {reference: mediaImage('https://cdn.example/poster.jpg')},
      });

      expect(fieldVideo(r, 'video')).toMatchObject({
        sources: [],
        externalUrl: 'https://youtu.be/abc123',
        poster: {url: 'https://cdn.example/poster.jpg'},
      });
    });

    it('is null without a playable source', () => {
      expect(
        fieldVideo(record({video: {reference: video([])}}), 'video'),
      ).toBeNull();
      expect(fieldVideo(record({}), 'video')).toBeNull();
      expect(fieldVideo(null, 'video')).toBeNull();
    });
  });

  it('fieldProductHandle and fieldCollectionHandle only accept their own type', () => {
    const product = {
      __typename: 'Product',
      id: 'p',
      handle: 'cloudalign',
      title: 'T',
    };
    const collection = {
      __typename: 'Collection',
      id: 'c',
      handle: 'bath',
      title: 'T',
    };
    const r = record({
      product: {reference: product},
      collection: {reference: collection},
    });

    expect(fieldProductHandle(r, 'product')).toBe('cloudalign');
    expect(fieldProductHandle(r, 'collection')).toBeNull();
    expect(fieldCollectionHandle(r, 'collection')).toBe('bath');
    expect(fieldCollectionHandle(r, 'product')).toBeNull();
    expect(fieldProductHandle(null, 'product')).toBeNull();
    expect(fieldCollectionHandle(null, 'collection')).toBeNull();
  });
});

describe('fieldUrl', () => {
  it.each([
    ['https://press.example/story', 'https://press.example/story'],
    ['/pages/press', '/pages/press'],
    ['mailto:press@example.com', 'mailto:press@example.com'],
    ['  https://press.example  ', 'https://press.example'],
  ])('keeps the safe URL %j', (value, expected) => {
    expect(fieldUrl(record({url: value}), 'url')).toBe(expected);
  });

  it.each(UNSAFE_URLS)('returns null for %j', (value) => {
    expect(fieldUrl(record({url: value}), 'url')).toBeNull();
  });

  it('returns null for a missing, blank or absent field', () => {
    expect(fieldUrl(record({url: '  '}), 'url')).toBeNull();
    expect(fieldUrl(record({}), 'url')).toBeNull();
    expect(fieldUrl(null, 'url')).toBeNull();
  });
});

describe('fieldLink', () => {
  const fallback = {label: 'Shop Now', url: '/collections/all'};

  it('uses the label and URL from the metaobject', () => {
    const link = fieldLink(
      record({cta_label: 'Our Story', cta_url: '/pages/about'}),
      'cta_label',
      'cta_url',
      fallback,
    );

    expect(link).toEqual({label: 'Our Story', url: '/pages/about'});
  });

  it('falls back field by field', () => {
    expect(
      fieldLink(
        record({cta_label: 'Only label'}),
        'cta_label',
        'cta_url',
        fallback,
      ),
    ).toEqual({label: 'Only label', url: '/collections/all'});
    expect(
      fieldLink(record({cta_url: '/x'}), 'cta_label', 'cta_url', fallback),
    ).toEqual({label: 'Shop Now', url: '/x'});
    expect(fieldLink(null, 'cta_label', 'cta_url', fallback)).toEqual(fallback);
  });

  it.each([
    'https://example.com/a',
    '/products/pillow?variant=1',
    '#faq',
    'mailto:hello@example.com',
    'tel:+15551234567',
  ])('keeps the safe URL %j', (url) => {
    const link = fieldLink(
      record({cta_label: 'Go', cta_url: url}),
      'cta_label',
      'cta_url',
      fallback,
    );

    expect(link.url).toBe(url);
  });

  it.each(UNSAFE_URLS)('never emits the script URL %j', (url) => {
    // Arrange
    const r = record({cta_label: 'Click me', cta_url: url});

    // Act
    const link = fieldLink(r, 'cta_label', 'cta_url', fallback);

    // Assert: the label survives, the href is the safe fallback.
    expect(link).toEqual({label: 'Click me', url: '/collections/all'});
  });
});

describe('mapSiteSettings', () => {
  const settings = (fields: Record<string, FieldInput>) =>
    mapSiteSettings(metaobject(fields));

  it('returns the defaults without a settings metaobject', () => {
    expect(mapSiteSettings(null)).toEqual(DEFAULT_SITE_SETTINGS);
    expect(mapSiteSettings(undefined)).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it('reads announcements, savings copy and trust badges', () => {
    const result = settings({
      announcements: list('Free shipping', 'Winter sale'),
      savings_note: 'Save big',
      savings_explanation: 'Because.',
      trust_badges: list('truck|Free returns', 'shield|30-Day Trial'),
    });

    expect(result).toEqual({
      announcements: ['Free shipping', 'Winter sale'],
      trustBadges: [
        {icon: 'truck', label: 'Free returns'},
        {icon: 'shield', label: '30-Day Trial'},
      ],
      savingsNote: 'Save big',
      savingsExplanation: 'Because.',
    });
  });

  it('uses the defaults for fields that are not set', () => {
    const result = settings({announcements: list('Only this')});

    expect(result.announcements).toEqual(['Only this']);
    expect(result.trustBadges).toEqual(DEFAULT_SITE_SETTINGS.trustBadges);
    expect(result.savingsNote).toBe(DEFAULT_SITE_SETTINGS.savingsNote);
  });

  describe('trust badge parsing', () => {
    const badges = (...entries: string[]) =>
      settings({trust_badges: list(...entries)}).trustBadges;

    it('accepts icon keys in any case, with padding', () => {
      expect(badges('  Truck | Free returns ')).toEqual([
        {icon: 'truck', label: 'Free returns'},
      ]);
    });

    it('splits at the first pipe only', () => {
      expect(badges('check|Free shipping | easy returns')).toEqual([
        {icon: 'check', label: 'Free shipping | easy returns'},
      ]);
    });

    it('does not truncate text whose prefix is not an icon', () => {
      // Arrange: defaults rotate by position when no icon is given.
      const [first, second] = DEFAULT_SITE_SETTINGS.trustBadges;

      // Act
      const result = badges('Free shipping | easy returns', 'Plain label');

      // Assert
      expect(result).toEqual([
        {icon: first.icon, label: 'Free shipping | easy returns'},
        {icon: second.icon, label: 'Plain label'},
      ]);
    });

    it.each([
      'constructor',
      'toString',
      'valueOf',
      '__proto__',
      'hasOwnProperty',
    ])('never resolves the inherited name "%s" as an icon', (name) => {
      // Act
      const [badge] = badges(`${name}|Soft`);

      // Assert
      expect(badge.label).toBe(`${name}|Soft`);
      expect(Object.hasOwn(FEATURE_ICONS, badge.icon)).toBe(true);
    });

    it('drops badges that have an icon but no label', () => {
      expect(badges('truck|', 'shield|Kept')).toEqual([
        {icon: 'shield', label: 'Kept'},
      ]);
    });

    it('falls back to the defaults when every badge is empty', () => {
      expect(badges('truck|')).toEqual(DEFAULT_SITE_SETTINGS.trustBadges);
    });

    it('survives defaults without any trust badges', () => {
      const result = mapSiteSettings(
        metaobject({trust_badges: list('No icon here')}),
        {...DEFAULT_SITE_SETTINGS, trustBadges: []},
      );

      expect(result.trustBadges).toEqual([
        {icon: 'shield', label: 'No icon here'},
      ]);
    });
  });
});

describe('mapHomeContent', () => {
  it('returns the defaults without data', () => {
    expect(mapHomeContent(null)).toBe(DEFAULT_HOME_CONTENT);
    expect(mapHomeContent(undefined)).toBe(DEFAULT_HOME_CONTENT);
  });

  it('returns the defaults for an empty store', () => {
    expect(mapHomeContent(homeQuery({}))).toEqual(DEFAULT_HOME_CONTENT);
  });

  describe('testimonials', () => {
    const testimonials = (...fields: Array<Record<string, FieldInput>>) =>
      mapHomeContent(
        homeQuery({
          testimonials: fields.map((entry, index) =>
            metaobject(entry, `gid://shopify/Metaobject/t${index}`),
          ),
        }),
      ).testimonials.items;

    it('maps quote, author and rating', () => {
      const [item] = testimonials({
        quote: 'Great.',
        author: 'Sam O.',
        rating: '4.5',
      });

      expect(item).toMatchObject({
        quote: 'Great.',
        author: 'Sam O.',
        rating: 4.5,
      });
    });

    it('has no rating (never 5 stars) when the field is missing', () => {
      const [item] = testimonials({quote: 'Great.', author: 'Sam O.'});

      expect(item.rating).toBeNull();
    });

    it.each(['', '  ', 'five', 'N/A', '9', '-2'])(
      'has no rating when the field is %j',
      (rating) => {
        const [item] = testimonials({quote: 'Great.', rating});

        expect(item.rating).toBeNull();
      },
    );

    it('honours the scale of Shopify rating JSON', () => {
      const [item] = testimonials({
        quote: 'Great.',
        rating: '{"value":"8","scale_max":"10"}',
      });

      expect(item.rating).toBe(4);
    });

    it('does not present an anonymous testimonial as verified', () => {
      const [item] = testimonials({quote: 'Great.'});

      expect(item.author).toBe('Customer');
    });

    it('links the referenced product', () => {
      const [item] = testimonials({
        quote: 'Great.',
        product: {
          reference: {
            __typename: 'Product',
            id: 'gid://shopify/Product/1',
            handle: 'cloudalign-pillow',
            title: 'CloudAlign Pillow',
          },
        },
      });

      expect(item).toMatchObject({
        productHandle: 'cloudalign-pillow',
        productTitle: 'CloudAlign Pillow',
      });
    });

    it('skips testimonials without a quote and falls back to the defaults', () => {
      const items = testimonials({author: 'No quote'}, {quote: '  '});

      expect(items).toEqual(DEFAULT_HOME_CONTENT.testimonials.items);
    });

    it('keeps the explicit ratings of the default testimonials', () => {
      for (const item of DEFAULT_HOME_CONTENT.testimonials.items) {
        expect(typeof item.rating).toBe('number');
      }
    });
  });

  describe('press logos', () => {
    const logos = (...fields: Array<Record<string, FieldInput>>) =>
      mapHomeContent(
        homeQuery({
          pressLogos: fields.map((entry, index) =>
            metaobject(entry, `gid://shopify/Metaobject/p${index}`),
          ),
        }),
      ).pressLogos;

    it('keeps safe links', () => {
      const result = logos(
        {name: 'Forbes', url: 'https://forbes.example/mellow'},
        {name: 'Local', url: '/pages/press'},
      );

      expect(result.map((logo) => logo.url)).toEqual([
        'https://forbes.example/mellow',
        '/pages/press',
      ]);
    });

    it.each(UNSAFE_URLS)('drops the script URL %j', (url) => {
      const [logo] = logos({name: 'Forbes', url});

      expect(logo.name).toBe('Forbes');
      expect(logo.url).toBeNull();
    });

    it('has no link when none is set', () => {
      expect(logos({name: 'Forbes'})[0].url).toBeNull();
    });

    it('skips logos without a name', () => {
      expect(logos({url: 'https://x.example'})).toEqual(
        DEFAULT_HOME_CONTENT.pressLogos,
      );
    });
  });

  describe('call to action links', () => {
    it('falls back to the default hero link for a script URL', () => {
      const content = mapHomeContent(
        homeQuery({
          hero: [
            metaobject({
              cta_label: 'Shop',
              cta_url: 'javascript:alert(1)',
            }),
          ],
        }),
      );

      expect(content.hero.cta).toEqual({
        label: 'Shop',
        url: DEFAULT_HOME_CONTENT.hero.cta.url,
      });
    });

    it('falls back to the default story link for a data URL', () => {
      const content = mapHomeContent(
        homeQuery({
          story: [
            metaobject({
              cta_label: 'Read',
              cta_url: 'data:text/html,<script>alert(1)</script>',
            }),
          ],
        }),
      );

      expect(content.story.cta).toEqual({
        label: 'Read',
        url: DEFAULT_HOME_CONTENT.story.cta?.url,
      });
    });

    it('keeps safe hero links', () => {
      const content = mapHomeContent(
        homeQuery({
          hero: [metaobject({cta_label: 'Shop', cta_url: '/collections/bath'})],
        }),
      );

      expect(content.hero.cta).toEqual({
        label: 'Shop',
        url: '/collections/bath',
      });
    });
  });

  describe('hero, story, featured products, videos and newsletter', () => {
    const home = (parts: Parameters<typeof homeQuery>[0]) =>
      mapHomeContent(homeQuery(parts));

    it('reads the hero', () => {
      const content = home({
        hero: [
          metaobject({
            rating_label: '200,000+ Happy Sleepers',
            rating: '4.5',
            headline: 'Sleep\nbetter',
            subheadline: 'Sub',
            image: {reference: mediaImage('https://cdn.example/hero.jpg')},
          }),
        ],
      });

      expect(content.hero).toMatchObject({
        ratingLabel: '200,000+ Happy Sleepers',
        rating: 4.5,
        headline: 'Sleep\nbetter',
        subheadline: 'Sub',
        image: {url: 'https://cdn.example/hero.jpg'},
      });
      expect(content.hero.cta).toEqual(DEFAULT_HOME_CONTENT.hero.cta);
    });

    it('keeps the default story link only while no story metaobject exists', () => {
      const withoutStory = home({});
      const storyWithoutCta = home({
        story: [metaobject({heading: 'Our story'})],
      });
      const storyWithCta = home({
        story: [metaobject({cta_label: 'Read', cta_url: '/pages/about'})],
      });

      expect(withoutStory.story.cta).toEqual(DEFAULT_HOME_CONTENT.story.cta);
      expect(storyWithoutCta.story.cta).toBeNull();
      expect(storyWithoutCta.story.heading).toBe('Our story');
      expect(storyWithCta.story.cta).toEqual({
        label: 'Read',
        url: '/pages/about',
      });
    });

    it('reads the featured collection and section copy from the settings', () => {
      const content = home({
        settings: [
          metaobject({
            featured_heading: 'Best sellers',
            featured_cta_label: 'See all',
            featured_collection: {
              reference: {
                __typename: 'Collection',
                id: 'c',
                handle: 'most-loved-2',
                title: 'T',
              },
            },
            newsletter_heading: 'Join us',
            faq_heading: 'FAQ',
          }),
        ],
      });

      expect(content.featured).toMatchObject({
        heading: 'Best sellers',
        ctaLabel: 'See all',
        collectionHandle: 'most-loved-2',
      });
      expect(content.newsletter.heading).toBe('Join us');
      expect(content.newsletter.placeholder).toBe(
        DEFAULT_HOME_CONTENT.newsletter.placeholder,
      );
      expect(content.faq.heading).toBe('FAQ');
    });

    it('maps UGC videos with their poster and product', () => {
      const content = home({
        ugcVideos: [
          metaobject({
            title: 'Unboxing',
            video: {
              reference: video(
                [{url: 'https://cdn.example/v.mp4', mimeType: 'video/mp4'}],
                'https://cdn.example/p.jpg',
              ),
            },
            product: {
              reference: {
                __typename: 'Product',
                id: 'p',
                handle: 'cloudalign',
                title: 'T',
              },
            },
          }),
          metaobject({}, 'gid://shopify/Metaobject/2'),
        ],
      });

      expect(content.ugc.videos).toHaveLength(2);
      expect(content.ugc.videos[0]).toMatchObject({
        title: 'Unboxing',
        productHandle: 'cloudalign',
        poster: {url: 'https://cdn.example/p.jpg'},
      });
      expect(content.ugc.videos[1]).toMatchObject({
        title: '',
        video: null,
        poster: null,
      });
    });

    it('keeps lifestyle images that have a picture, with their caption', () => {
      const content = home({
        lifestyle: [
          metaobject({
            image: {reference: mediaImage('https://cdn.example/l.jpg')},
            caption: 'Cosy',
          }),
          metaobject({caption: 'No picture'}, 'gid://shopify/Metaobject/2'),
        ],
      });

      expect(content.lifestyle).toHaveLength(1);
      expect(content.lifestyle[0]).toMatchObject({
        url: 'https://cdn.example/l.jpg',
        caption: 'Cosy',
      });
    });
  });

  it('keeps FAQ entries that have both a question and an answer', () => {
    const content = mapHomeContent(
      homeQuery({
        faqs: [
          metaobject(
            {question: 'Q1', answer: 'A1'},
            'gid://shopify/Metaobject/f1',
          ),
          metaobject({question: 'Q2'}, 'gid://shopify/Metaobject/f2'),
        ],
      }),
    );

    expect(content.faq.items).toEqual([
      {id: 'gid://shopify/Metaobject/f1', question: 'Q1', answer: 'A1'},
    ]);
  });
});

describe('mapAboutContent', () => {
  const values = (...entries: string[]) =>
    mapAboutContent(aboutQuery([metaobject({values: list(...entries)})]))
      .values;

  it('returns the defaults without data', () => {
    expect(mapAboutContent(null)).toBe(DEFAULT_ABOUT_CONTENT);
    expect(mapAboutContent(undefined)).toBe(DEFAULT_ABOUT_CONTENT);
    expect(mapAboutContent(aboutQuery([]))).toBe(DEFAULT_ABOUT_CONTENT);
  });

  describe('values', () => {
    it('maps "icon|title|body" entries', () => {
      const result = values('snowflake|Cool|Stays cool all night');

      expect(result).toEqual([
        {
          id: 'gid://shopify/Metaobject/1-value-0',
          icon: 'snowflake',
          title: 'Cool',
          body: 'Stays cool all night',
        },
      ]);
    });

    it('accepts icon keys in any case, with padding', () => {
      expect(values(' Moon | Sleep | Better ')[0]).toMatchObject({
        icon: 'moon',
        title: 'Sleep',
        body: 'Better',
      });
    });

    it('keeps pipes inside the body', () => {
      expect(values('wash|Washable|Cold | gentle | line dry')[0].body).toBe(
        'Cold | gentle | line dry',
      );
    });

    it('does not truncate an entry whose first part is not an icon', () => {
      // Arrange + Act
      const [value] = values('Machine washable | tumble dry low');

      // Assert: nothing is cut off and the entry gets the fallback icon.
      expect(value).toMatchObject({
        icon: 'sparkle',
        title: 'Machine washable',
        body: 'tumble dry low',
      });
    });

    it('accepts an entry that is only a title', () => {
      expect(values('Just a title')[0]).toMatchObject({
        icon: 'sparkle',
        title: 'Just a title',
        body: '',
      });
    });

    it.each([
      'constructor',
      'toString',
      'valueOf',
      '__proto__',
      'hasOwnProperty',
    ])('never resolves the inherited name "%s" as an icon', (name) => {
      // Act
      const [value] = values(`${name}|Soft|Body`);

      // Assert: renders with a real icon and keeps all of the text.
      expect(Object.hasOwn(FEATURE_ICONS, value.icon)).toBe(true);
      expect(`${value.title}|${value.body}`).toBe(`${name}|Soft|Body`);
    });

    it.each(['snowflake|', 'moon||Body', '  ', 'wash| |x'])(
      'drops the entry %j because it has no title',
      (entry) => {
        expect(values(entry, 'moon|Kept|ok').map((v) => v.title)).toEqual([
          'Kept',
        ]);
      },
    );

    it('falls back to the default values when none are usable', () => {
      expect(values('snowflake|')).toEqual(DEFAULT_ABOUT_CONTENT.values);
    });
  });

  describe('links', () => {
    const about = (fields: Record<string, FieldInput>) =>
      mapAboutContent(aboutQuery([metaobject(fields)]));

    it('keeps safe links', () => {
      const content = about({
        hero_cta_label: 'Shop',
        hero_cta_url: '/collections/bath',
        closing_cta_label: 'Mail us',
        closing_cta_url: 'mailto:hello@example.com',
      });

      expect(content.hero.cta).toEqual({
        label: 'Shop',
        url: '/collections/bath',
      });
      expect(content.closing.cta).toEqual({
        label: 'Mail us',
        url: 'mailto:hello@example.com',
      });
    });

    it('replaces script URLs with the default links', () => {
      const content = about({
        hero_cta_label: 'Shop',
        hero_cta_url: 'javascript:alert(1)',
        closing_cta_label: 'Buy',
        closing_cta_url: 'data:text/html,hi',
      });

      expect(content.hero.cta.url).toBe(DEFAULT_ABOUT_CONTENT.hero.cta.url);
      expect(content.closing.cta.url).toBe(
        DEFAULT_ABOUT_CONTENT.closing.cta.url,
      );
    });
  });
});
