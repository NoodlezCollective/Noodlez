/**
 * Shopify metaobject queries and mappers for editorial content.
 *
 * Every mapper takes the Storefront API result (possibly null when the
 * merchant has not created the metaobject definitions yet) and a defaults
 * object, and returns a complete content contract. Missing fields fall back
 * field-by-field so partially configured content still renders correctly.
 */
import type {
  AboutContentQuery,
  HomeContentQuery,
  MellowMetaobjectFragment,
  MellowReferenceFragment,
} from 'storefrontapi.generated';
import {safeHref} from '~/lib/urls';
import {
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_HOME_CONTENT,
  DEFAULT_SITE_SETTINGS,
} from './defaults';
import {parseRating, parseStringList, splitIconPrefix} from './metafields';
import type {
  AboutContent,
  AboutValue,
  FaqItem,
  FreeGiftOffer,
  HomeContent,
  ImageContent,
  LifestyleImage,
  LinkContent,
  PressLogo,
  ProofStat,
  SiteSettings,
  Testimonial,
  TrustBadge,
  UgcVideo,
  VideoContent,
} from './types';

/* -------------------------------------------------------------------------- */
/* GraphQL                                                                     */
/* -------------------------------------------------------------------------- */

export const MELLOW_REFERENCE_FRAGMENT = `#graphql
  fragment MellowReference on MetafieldReference {
    __typename
    ... on MediaImage {
      id
      image {
        url
        altText
        width
        height
      }
    }
    ... on Video {
      id
      sources {
        url
        mimeType
      }
      previewImage {
        url
        altText
        width
        height
      }
    }
    ... on GenericFile {
      id
      url
      mimeType
    }
    ... on Product {
      id
      handle
      title
    }
    ... on Collection {
      id
      handle
      title
    }
    ... on Page {
      id
      handle
      title
    }
    ... on Metaobject {
      id
      handle
      type
      fields {
        key
        type
        value
        reference {
          ... on MediaImage {
            id
            image {
              url
              altText
              width
              height
            }
          }
          ... on Video {
            id
            sources {
              url
              mimeType
            }
            previewImage {
              url
              altText
              width
              height
            }
          }
          ... on Product {
            id
            handle
            title
          }
        }
      }
    }
  }
` as const;

export const MELLOW_METAOBJECT_FRAGMENT = `#graphql
  fragment MellowMetaobject on Metaobject {
    id
    handle
    type
    fields {
      key
      type
      value
      reference {
        ...MellowReference
      }
    }
  }
  ${MELLOW_REFERENCE_FRAGMENT}
` as const;

/**
 * Homepage content, plus the section headings and the featured collection kept
 * on the settings metaobject. The homepage loader awaits it: the featured
 * collection decides which products the next query fetches.
 */
export const HOME_CONTENT_QUERY = `#graphql
  query HomeContent($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    settings: metaobjects(type: "mellow_settings", first: 1) {
      nodes {
        ...MellowMetaobject
      }
    }
    hero: metaobjects(type: "mellow_hero", first: 1) {
      nodes {
        ...MellowMetaobject
      }
    }
    pressLogos: metaobjects(type: "mellow_press_logo", first: 12) {
      nodes {
        ...MellowMetaobject
      }
    }
    story: metaobjects(type: "mellow_story", first: 1) {
      nodes {
        ...MellowMetaobject
      }
    }
    ugcVideos: metaobjects(type: "mellow_ugc_video", first: 8) {
      nodes {
        ...MellowMetaobject
      }
    }
    lifestyle: metaobjects(type: "mellow_lifestyle_image", first: 4) {
      nodes {
        ...MellowMetaobject
      }
    }
    testimonials: metaobjects(type: "mellow_testimonial", first: 9) {
      nodes {
        ...MellowMetaobject
      }
    }
    faqs: metaobjects(type: "mellow_faq", first: 12) {
      nodes {
        ...MellowMetaobject
      }
    }
  }
  ${MELLOW_METAOBJECT_FRAGMENT}
` as const;

/** Global settings only (announcement bar, trust badges, savings note). */
export const SITE_SETTINGS_QUERY = `#graphql
  query SiteSettings($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    settings: metaobjects(type: "mellow_settings", first: 1) {
      nodes {
        ...MellowMetaobject
      }
    }
  }
  ${MELLOW_METAOBJECT_FRAGMENT}
` as const;

export const ABOUT_CONTENT_QUERY = `#graphql
  query AboutContent($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    about: metaobjects(type: "mellow_about", first: 1) {
      nodes {
        ...MellowMetaobject
      }
    }
  }
  ${MELLOW_METAOBJECT_FRAGMENT}
` as const;

/* -------------------------------------------------------------------------- */
/* Generic field access                                                        */
/* -------------------------------------------------------------------------- */

type MetaobjectField = MellowMetaobjectFragment['fields'][number];
type Reference = MellowReferenceFragment;

export type MetaobjectRecord = {
  id: string;
  handle: string;
  type: string;
  fields: Map<string, MetaobjectField>;
};

export function toRecord(node: MellowMetaobjectFragment): MetaobjectRecord {
  return {
    id: node.id,
    handle: node.handle,
    type: node.type,
    fields: new Map(node.fields.map((field) => [field.key, field])),
  };
}

function firstRecord(
  connection: {nodes: MellowMetaobjectFragment[]} | null | undefined,
): MetaobjectRecord | null {
  const node = connection?.nodes?.[0];
  return node ? toRecord(node) : null;
}

function allRecords(
  connection: {nodes: MellowMetaobjectFragment[]} | null | undefined,
): MetaobjectRecord[] {
  return (connection?.nodes ?? []).map(toRecord);
}

export function fieldText(
  record: MetaobjectRecord | null,
  key: string,
): string | null {
  const value = record?.fields.get(key)?.value;
  return value && value.trim().length ? value : null;
}

export function fieldNumber(
  record: MetaobjectRecord | null,
  key: string,
): number | null {
  const raw = fieldText(record, key);
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export function fieldList(record: MetaobjectRecord | null, key: string) {
  return parseStringList({value: fieldText(record, key)});
}

function referenceToImage(
  ref: Reference | null | undefined,
): ImageContent | null {
  if (!ref) return null;
  if (ref.__typename === 'MediaImage' && ref.image?.url) {
    return {
      url: ref.image.url,
      altText: ref.image.altText ?? null,
      width: ref.image.width,
      height: ref.image.height,
    };
  }
  if (ref.__typename === 'Video' && ref.previewImage?.url) {
    return {
      url: ref.previewImage.url,
      altText: ref.previewImage.altText ?? null,
      width: ref.previewImage.width,
      height: ref.previewImage.height,
    };
  }
  if (
    ref.__typename === 'GenericFile' &&
    ref.url &&
    ref.mimeType?.startsWith('image/')
  ) {
    return {url: ref.url, altText: null};
  }
  return null;
}

export function fieldImage(
  record: MetaobjectRecord | null,
  key: string,
): ImageContent | null {
  return referenceToImage(record?.fields.get(key)?.reference);
}

export function fieldVideo(
  record: MetaobjectRecord | null,
  videoKey: string,
  posterKey = 'poster',
  externalUrlKey = 'video_url',
  captionsKey = 'captions',
): VideoContent | null {
  const ref = record?.fields.get(videoKey)?.reference;
  const externalUrl = fieldText(record, externalUrlKey);
  const poster =
    fieldImage(record, posterKey) ??
    (ref?.__typename === 'Video' ? referenceToImage(ref) : null);
  // An optional WebVTT file (generic file reference) for self-hosted sources.
  const captionsRef = record?.fields.get(captionsKey)?.reference;
  const captions =
    captionsRef?.__typename === 'GenericFile' && captionsRef.url
      ? {captions: {url: captionsRef.url}}
      : {};
  if (ref?.__typename === 'Video' && ref.sources?.length) {
    return {
      sources: ref.sources.map((source) => ({
        url: source.url,
        mimeType: source.mimeType,
      })),
      poster,
      externalUrl,
      ...captions,
    };
  }
  if (externalUrl) {
    return {sources: [], poster, externalUrl, ...captions};
  }
  return null;
}

export function fieldProductHandle(
  record: MetaobjectRecord | null,
  key: string,
): string | null {
  const ref = record?.fields.get(key)?.reference;
  return ref?.__typename === 'Product' ? ref.handle : null;
}

export function fieldCollectionHandle(
  record: MetaobjectRecord | null,
  key: string,
): string | null {
  const ref = record?.fields.get(key)?.reference;
  return ref?.__typename === 'Collection' ? ref.handle : null;
}

/**
 * An optional link field: the merchant's URL when it is safe to put in an
 * `href` (relative, http(s), mailto, tel), otherwise `null`. `javascript:` and
 * `data:` values entered in the Shopify admin can never become links.
 */
export function fieldUrl(
  record: MetaobjectRecord | null,
  key: string,
): string | null {
  return safeHref(fieldText(record, key), '') || null;
}

/**
 * A label + URL pair. A missing or unsafe URL falls back to `fallback.url`,
 * which is trusted code, so the result is always safe to render as a link.
 */
export function fieldLink(
  record: MetaobjectRecord | null,
  labelKey: string,
  urlKey: string,
  fallback: LinkContent,
): LinkContent {
  return {
    label: fieldText(record, labelKey) ?? fallback.label,
    url: safeHref(fieldText(record, urlKey), fallback.url),
  };
}

/* -------------------------------------------------------------------------- */
/* Mappers                                                                     */
/* -------------------------------------------------------------------------- */

export function mapSiteSettings(
  settingsNode: MellowMetaobjectFragment | null | undefined,
  defaults: SiteSettings = DEFAULT_SITE_SETTINGS,
): SiteSettings {
  const record = settingsNode ? toRecord(settingsNode) : null;
  const announcements = fieldList(record, 'announcements');
  const trustBadges: TrustBadge[] = fieldList(record, 'trust_badges').flatMap(
    (entry, index) => {
      const {icon, text} = splitIconPrefix(entry);
      if (!text) return [];
      const rotated = defaults.trustBadges[index % defaults.trustBadges.length];
      return [{icon: icon ?? rotated?.icon ?? 'shield', label: text}];
    },
  );
  const giftThreshold = fieldNumber(record, 'free_gift_threshold');
  const giftLabel = fieldText(record, 'free_gift_label');
  // A threshold of 0 (or below) switches the offer off; no field keeps the default.
  const freeGift: FreeGiftOffer | null =
    giftThreshold === null
      ? defaults.freeGift
      : giftThreshold > 0
        ? {
            threshold: giftThreshold,
            label: giftLabel ?? defaults.freeGift?.label ?? 'a free gift',
            code: fieldText(record, 'free_gift_code'),
          }
        : null;
  const proofStats: ProofStat[] = fieldList(record, 'proof_stats').flatMap(
    (entry, index) => {
      const [rawValue, ...rest] = entry.split('|');
      const value = Number(rawValue?.replace('%', '').trim());
      const label = rest.join('|').trim();
      if (!Number.isFinite(value) || value < 0 || value > 100 || !label) {
        return [];
      }
      return [{id: `stat-${index}`, value: Math.round(value), label}];
    },
  );
  return {
    announcements: announcements.length
      ? announcements
      : defaults.announcements,
    trustBadges: trustBadges.length ? trustBadges : defaults.trustBadges,
    savingsNote: fieldText(record, 'savings_note') ?? defaults.savingsNote,
    savingsExplanation:
      fieldText(record, 'savings_explanation') ?? defaults.savingsExplanation,
    cartHeading: fieldText(record, 'cart_heading') ?? defaults.cartHeading,
    ratingLabel: fieldText(record, 'rating_label') ?? defaults.ratingLabel,
    footerCta: {
      heading:
        fieldText(record, 'footer_cta_heading') ?? defaults.footerCta.heading,
      label: fieldText(record, 'footer_cta_label') ?? defaults.footerCta.label,
      url: fieldText(record, 'footer_cta_url') ?? defaults.footerCta.url,
    },
    copyright: fieldText(record, 'copyright') ?? defaults.copyright,
    freeGift,
    proofStats: proofStats.length ? proofStats : defaults.proofStats,
  };
}

export function mapHomeContent(
  data: HomeContentQuery | null | undefined,
  defaults: HomeContent = DEFAULT_HOME_CONTENT,
): HomeContent {
  if (!data) return defaults;

  const settings = firstRecord(data.settings);
  const hero = firstRecord(data.hero);
  const story = firstRecord(data.story);

  const pressLogos: PressLogo[] = allRecords(data.pressLogos).flatMap(
    (record) => {
      const name = fieldText(record, 'name');
      if (!name) return [];
      return [
        {
          id: record.id,
          name,
          image: fieldImage(record, 'image'),
          url: fieldUrl(record, 'url'),
        },
      ];
    },
  );

  const ugcVideos: UgcVideo[] = allRecords(data.ugcVideos).map((record) => ({
    id: record.id,
    title: fieldText(record, 'title') ?? '',
    video: fieldVideo(record, 'video'),
    poster:
      fieldImage(record, 'poster') ??
      fieldVideo(record, 'video')?.poster ??
      null,
    productHandle: fieldProductHandle(record, 'product'),
  }));

  const lifestyle: LifestyleImage[] = allRecords(data.lifestyle).flatMap(
    (record) => {
      const image = fieldImage(record, 'image');
      if (!image) return [];
      return [{...image, id: record.id, caption: fieldText(record, 'caption')}];
    },
  );

  const testimonials: Testimonial[] = allRecords(data.testimonials).flatMap(
    (record) => {
      const quote = fieldText(record, 'quote');
      if (!quote) return [];
      const productRef = record.fields.get('product')?.reference;
      return [
        {
          id: record.id,
          quote,
          author: fieldText(record, 'author') ?? 'Customer',
          // No rating means no stars: never an invented 5.
          rating: parseRating({value: fieldText(record, 'rating')}),
          productTitle:
            productRef?.__typename === 'Product' ? productRef.title : null,
          productHandle:
            productRef?.__typename === 'Product' ? productRef.handle : null,
        },
      ];
    },
  );

  const faqs: FaqItem[] = allRecords(data.faqs).flatMap((record) => {
    const question = fieldText(record, 'question');
    const answer = fieldText(record, 'answer');
    return question && answer ? [{id: record.id, question, answer}] : [];
  });

  return {
    hero: {
      ratingLabel: fieldText(hero, 'rating_label') ?? defaults.hero.ratingLabel,
      rating: fieldNumber(hero, 'rating') ?? defaults.hero.rating,
      headline: fieldText(hero, 'headline') ?? defaults.hero.headline,
      subheadline: fieldText(hero, 'subheadline') ?? defaults.hero.subheadline,
      cta: fieldLink(hero, 'cta_label', 'cta_url', defaults.hero.cta),
      image: fieldImage(hero, 'image') ?? defaults.hero.image,
    },
    pressLogos: pressLogos.length ? pressLogos : defaults.pressLogos,
    story: {
      heading: fieldText(story, 'heading') ?? defaults.story.heading,
      body: fieldText(story, 'body') ?? defaults.story.body,
      video: fieldVideo(story, 'video') ?? defaults.story.video,
      cta: story
        ? fieldText(story, 'cta_label')
          ? fieldLink(
              story,
              'cta_label',
              'cta_url',
              defaults.story.cta ?? {label: '', url: '/'},
            )
          : null
        : defaults.story.cta,
    },
    featured: {
      heading:
        fieldText(settings, 'featured_heading') ?? defaults.featured.heading,
      subheading:
        fieldText(settings, 'featured_subheading') ??
        defaults.featured.subheading,
      collectionHandle:
        fieldCollectionHandle(settings, 'featured_collection') ??
        defaults.featured.collectionHandle,
      ctaLabel:
        fieldText(settings, 'featured_cta_label') ?? defaults.featured.ctaLabel,
    },
    ugc: {
      heading: fieldText(settings, 'ugc_heading') ?? defaults.ugc.heading,
      subheading:
        fieldText(settings, 'ugc_subheading') ?? defaults.ugc.subheading,
      videos: ugcVideos.length ? ugcVideos : defaults.ugc.videos,
    },
    lifestyle: lifestyle.length ? lifestyle : defaults.lifestyle,
    testimonials: {
      heading:
        fieldText(settings, 'testimonials_heading') ??
        defaults.testimonials.heading,
      subheading:
        fieldText(settings, 'testimonials_subheading') ??
        defaults.testimonials.subheading,
      items: testimonials.length ? testimonials : defaults.testimonials.items,
    },
    faq: {
      heading: fieldText(settings, 'faq_heading') ?? defaults.faq.heading,
      items: faqs.length ? faqs : defaults.faq.items,
    },
    newsletter: {
      heading:
        fieldText(settings, 'newsletter_heading') ??
        defaults.newsletter.heading,
      body: fieldText(settings, 'newsletter_body') ?? defaults.newsletter.body,
      placeholder: defaults.newsletter.placeholder,
      ctaLabel:
        fieldText(settings, 'newsletter_cta_label') ??
        defaults.newsletter.ctaLabel,
    },
  };
}

export function mapAboutContent(
  data: AboutContentQuery | null | undefined,
  defaults: AboutContent = DEFAULT_ABOUT_CONTENT,
): AboutContent {
  const about = data ? firstRecord(data.about) : null;
  if (!about) return defaults;

  const values: AboutValue[] = fieldList(about, 'values').flatMap(
    (entry, index) => {
      // "icon|title|body", where the icon is optional ("title|body").
      const {icon, text} = splitIconPrefix(entry);
      const separator = text.indexOf('|');
      const title = (separator === -1 ? text : text.slice(0, separator)).trim();
      if (!title) return [];
      return [
        {
          id: `${about.id}-value-${index}`,
          icon: icon ?? 'sparkle',
          title,
          body: separator === -1 ? '' : text.slice(separator + 1).trim(),
        },
      ];
    },
  );

  return {
    hero: {
      heading: fieldText(about, 'hero_heading') ?? defaults.hero.heading,
      subheading:
        fieldText(about, 'hero_subheading') ?? defaults.hero.subheading,
      cta: fieldLink(
        about,
        'hero_cta_label',
        'hero_cta_url',
        defaults.hero.cta,
      ),
      image: fieldImage(about, 'hero_image') ?? defaults.hero.image,
    },
    story: {
      heading: fieldText(about, 'story_heading') ?? defaults.story.heading,
      body: fieldText(about, 'story_body') ?? defaults.story.body,
      highlight:
        fieldText(about, 'story_highlight') ?? defaults.story.highlight,
    },
    imageLeft: fieldImage(about, 'image_left') ?? defaults.imageLeft,
    imageBottom: fieldImage(about, 'image_bottom') ?? defaults.imageBottom,
    values: values.length ? values : defaults.values,
    closing: {
      heading: fieldText(about, 'closing_heading') ?? defaults.closing.heading,
      body: fieldText(about, 'closing_body') ?? defaults.closing.body,
      cta: fieldLink(
        about,
        'closing_cta_label',
        'closing_cta_url',
        defaults.closing.cta,
      ),
    },
  };
}
