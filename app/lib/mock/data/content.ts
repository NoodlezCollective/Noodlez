/**
 * Metaobject seeds for the development mock, generated from the storefront's
 * fallback content so the Shopify → contract mapping path is exercised in
 * development exactly as it will be with a real store.
 */
import {
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_HOME_CONTENT,
  DEFAULT_SITE_SETTINGS,
} from '~/lib/content/defaults';
import type {ImageContent} from '~/lib/content/types';
import type {
  MediaImageSeed,
  MetaobjectFieldSeed,
  MetaobjectSeed,
} from './types';

const mediaImages: MediaImageSeed[] = [];

function media(id: string, image: ImageContent | null): string | null {
  if (!image) return null;
  const gid = `gid://shopify/MediaImage/${id}`;
  if (!mediaImages.some((m) => m.id === gid)) {
    mediaImages.push({
      id: gid,
      image: {
        id: `gid://shopify/Image/${id}`,
        url: image.url,
        altText: image.altText ?? '',
        width: image.width ?? 1200,
        height: image.height ?? 1200,
      },
    });
  }
  return gid;
}

function text(
  key: string,
  value: string | null | undefined,
  type = 'single_line_text_field',
): MetaobjectFieldSeed {
  return {key, type, value: value ?? null};
}

function fileRef(key: string, gid: string | null): MetaobjectFieldSeed {
  return {key, type: 'file_reference', value: gid, reference: gid};
}

function productRef(
  key: string,
  handle: string | null | undefined,
): MetaobjectFieldSeed {
  const gid = handle ? `gid://shopify/Product/handle:${handle}` : null;
  return {key, type: 'product_reference', value: gid, reference: gid};
}

const home = DEFAULT_HOME_CONTENT;
const about = DEFAULT_ABOUT_CONTENT;
const settings = DEFAULT_SITE_SETTINGS;

export const METAOBJECT_SEEDS: MetaobjectSeed[] = [
  {
    id: 'gid://shopify/Metaobject/settings',
    handle: 'storefront',
    type: 'mellow_settings',
    fields: [
      text(
        'announcements',
        JSON.stringify(settings.announcements),
        'list.single_line_text_field',
      ),
      text(
        'trust_badges',
        JSON.stringify(settings.trustBadges.map((b) => `${b.icon}|${b.label}`)),
        'list.single_line_text_field',
      ),
      text('savings_note', settings.savingsNote),
      text(
        'savings_explanation',
        settings.savingsExplanation,
        'multi_line_text_field',
      ),
      text('featured_heading', home.featured.heading),
      text(
        'featured_subheading',
        home.featured.subheading,
        'multi_line_text_field',
      ),
      {
        key: 'featured_collection',
        type: 'collection_reference',
        value: 'gid://shopify/Collection/2002',
        reference: 'gid://shopify/Collection/2002',
      },
      text('featured_cta_label', home.featured.ctaLabel),
      text('ugc_heading', home.ugc.heading),
      text('ugc_subheading', home.ugc.subheading),
      text('testimonials_heading', home.testimonials.heading),
      text('testimonials_subheading', home.testimonials.subheading),
      text('faq_heading', home.faq.heading),
      text('newsletter_heading', home.newsletter.heading),
      text('newsletter_body', home.newsletter.body, 'multi_line_text_field'),
      text('newsletter_cta_label', home.newsletter.ctaLabel),
    ],
  },
  {
    id: 'gid://shopify/Metaobject/hero',
    handle: 'homepage-hero',
    type: 'mellow_hero',
    fields: [
      text('rating_label', home.hero.ratingLabel),
      text('rating', String(home.hero.rating), 'number_decimal'),
      text('headline', home.hero.headline, 'multi_line_text_field'),
      text('subheadline', home.hero.subheadline, 'multi_line_text_field'),
      text('cta_label', home.hero.cta.label),
      text('cta_url', home.hero.cta.url, 'url'),
      fileRef('image', media('hero', home.hero.image)),
    ],
  },
  ...home.pressLogos.map((logo, index) => ({
    id: `gid://shopify/Metaobject/press-${index + 1}`,
    handle: logo.id,
    type: 'mellow_press_logo',
    fields: [
      text('name', logo.name),
      fileRef('image', media(`press-${logo.id}`, logo.image)),
      text('url', logo.url ?? null, 'url'),
    ],
  })),
  {
    id: 'gid://shopify/Metaobject/story',
    handle: 'homepage-story',
    type: 'mellow_story',
    fields: [
      text('heading', home.story.heading),
      text('body', home.story.body, 'multi_line_text_field'),
      fileRef('video', null),
      text('video_url', null, 'url'),
      fileRef(
        'poster',
        media('story-poster', home.story.video?.poster ?? null),
      ),
      text('cta_label', home.story.cta?.label ?? null),
      text('cta_url', home.story.cta?.url ?? null, 'url'),
    ],
  },
  ...home.ugc.videos.map((video, index) => ({
    id: `gid://shopify/Metaobject/ugc-${index + 1}`,
    handle: video.id,
    type: 'mellow_ugc_video',
    fields: [
      text('title', video.title),
      fileRef('video', null),
      text('video_url', null, 'url'),
      fileRef('poster', media(`ugc-${index + 1}`, video.poster)),
      productRef('product', video.productHandle),
    ],
  })),
  ...home.lifestyle.map((item, index) => ({
    id: `gid://shopify/Metaobject/lifestyle-${index + 1}`,
    handle: item.id,
    type: 'mellow_lifestyle_image',
    fields: [
      fileRef('image', media(`lifestyle-${index + 1}`, item)),
      text('caption', item.caption ?? null),
    ],
  })),
  ...home.testimonials.items.map((item, index) => ({
    id: `gid://shopify/Metaobject/testimonial-${index + 1}`,
    handle: item.id,
    type: 'mellow_testimonial',
    fields: [
      text('quote', item.quote, 'multi_line_text_field'),
      text('author', item.author),
      text(
        'rating',
        item.rating == null ? null : String(item.rating),
        'number_decimal',
      ),
      productRef('product', item.productHandle),
    ],
  })),
  ...home.faq.items.map((item, index) => ({
    id: `gid://shopify/Metaobject/faq-${index + 1}`,
    handle: item.id,
    type: 'mellow_faq',
    fields: [
      text('question', item.question),
      text('answer', item.answer, 'multi_line_text_field'),
    ],
  })),
  {
    id: 'gid://shopify/Metaobject/about',
    handle: 'about-page',
    type: 'mellow_about',
    fields: [
      text('hero_heading', about.hero.heading, 'multi_line_text_field'),
      text('hero_subheading', about.hero.subheading),
      text('hero_cta_label', about.hero.cta.label),
      text('hero_cta_url', about.hero.cta.url, 'url'),
      fileRef('hero_image', media('about-hero', about.hero.image)),
      text('story_heading', about.story.heading),
      text('story_body', about.story.body, 'multi_line_text_field'),
      text('story_highlight', about.story.highlight),
      fileRef('image_left', media('about-left', about.imageLeft)),
      fileRef('image_bottom', media('about-bottom', about.imageBottom)),
      text(
        'values',
        JSON.stringify(
          about.values.map((v) => `${v.icon}|${v.title}|${v.body}`),
        ),
        'list.single_line_text_field',
      ),
      text('closing_heading', about.closing.heading),
      text('closing_body', about.closing.body, 'multi_line_text_field'),
      text('closing_cta_label', about.closing.cta.label),
      text('closing_cta_url', about.closing.cta.url, 'url'),
    ],
  },
  ...[
    {
      rating: 5,
      title: 'Finally, no neck pain',
      body: 'I wake up without neck pain for the first time in years. The CloudAlign actually keeps my head where it should be.',
      author: 'Jenna R.',
    },
    {
      rating: 5,
      title: 'Worth every penny',
      body: 'Soft but supportive. I ordered a second one for my partner after one night.',
      author: 'Daniel K.',
    },
    {
      rating: 5,
      title: 'Fluffiest comforter ever',
      body: 'It washed beautifully and came out of the dryer just as fluffy. Hotel-bed feel at home.',
      author: 'Priya S.',
    },
    {
      rating: 5,
      title: 'Goes everywhere with me',
      body: 'Couch, car, desk. The cool side is a lifesaver on hot afternoons.',
      author: 'Sam O.',
    },
    {
      rating: 4,
      title: 'Cute and comfy',
      body: 'Love the baby blue. Slightly smaller than I expected but it is perfect for the couch.',
      author: 'Maria L.',
    },
    {
      rating: 5,
      title: 'My new favourite',
      body: 'The lush cover is unbelievably soft. I bought the cream one and then the stone one.',
      author: 'Chris B.',
    },
  ].map((review, index) => ({
    id: `gid://shopify/Metaobject/review-${index + 1}`,
    handle: `review-${index + 1}`,
    type: 'mellow_review',
    fields: [
      text(
        'rating',
        review.rating == null ? null : String(review.rating),
        'number_integer',
      ),
      text('title', review.title),
      text('body', review.body, 'multi_line_text_field'),
      text('author', review.author),
      text('verified', 'true', 'boolean'),
      text('date', '2026-09-12', 'date'),
    ],
  })),
];

export const MEDIA_IMAGE_SEEDS: MediaImageSeed[] = mediaImages;
