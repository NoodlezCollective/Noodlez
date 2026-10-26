/**
 * Typed content contracts for the Mellow storefront.
 *
 * Everything that is not core Shopify commerce data (products, collections,
 * cart) is modelled here explicitly. Content is sourced from Shopify
 * metaobjects / metafields (see metaobjects.ts and metafields.ts) and falls
 * back to the defaults in defaults.ts so the storefront renders the documented
 * design before a merchant has configured Shopify.
 */
import type {CurrencyCode} from '@shopify/hydrogen-react/storefront-api-types';
import type {FeatureIconKey} from '~/components/ui/Icons';

export type ImageContent = {
  url: string;
  altText: string | null;
  width?: number | null;
  height?: number | null;
};

export type VideoSource = {url: string; mimeType: string};

/** A WebVTT captions file for a self-hosted video. */
export type VideoCaptions = {
  url: string;
  /** BCP 47 language of the captions. Defaults to "en" (the storefront language). */
  language?: string;
  /** Name shown in the player's captions menu. Defaults to "English". */
  label?: string;
};

export type VideoContent = {
  sources: VideoSource[];
  poster: ImageContent | null;
  /** YouTube/Vimeo URL when the video is hosted externally. */
  externalUrl?: string | null;
  /** Captions for the self-hosted sources (metaobject `captions` file). */
  captions?: VideoCaptions | null;
};

export type LinkContent = {label: string; url: string};

export type HeroContent = {
  /** Small label next to the stars, e.g. "124,952+ Happy Sleepers". */
  ratingLabel: string | null;
  rating: number;
  /** Line breaks ("\n") are honoured. */
  headline: string;
  subheadline: string;
  cta: LinkContent;
  image: ImageContent | null;
};

export type PressLogo = {
  id: string;
  name: string;
  image: ImageContent | null;
  url?: string | null;
};

export type StoryContent = {
  heading: string;
  body: string;
  video: VideoContent | null;
  cta?: LinkContent | null;
};

export type FeaturedProductsContent = {
  heading: string;
  subheading: string;
  /** Collection handle that drives the grid. */
  collectionHandle: string;
  ctaLabel: string;
};

export type UgcVideo = {
  id: string;
  title: string;
  video: VideoContent | null;
  poster: ImageContent | null;
  productHandle?: string | null;
};

export type UgcContent = {
  heading: string;
  subheading: string;
  videos: UgcVideo[];
};

export type LifestyleImage = ImageContent & {
  id: string;
  caption?: string | null;
};

export type Testimonial = {
  id: string;
  quote: string;
  author: string;
  /** Stars on a 0 to 5 scale; `null` when the merchant did not set one. */
  rating: number | null;
  productTitle?: string | null;
  productHandle?: string | null;
};

export type TestimonialsContent = {
  heading: string;
  subheading: string;
  items: Testimonial[];
};

export type FaqItem = {id: string; question: string; answer: string};

export type FaqContent = {heading: string; items: FaqItem[]};

export type NewsletterContent = {
  heading: string;
  body: string;
  placeholder: string;
  ctaLabel: string;
};

export type TrustBadge = {icon: FeatureIconKey; label: string};

export type ProductFeature = {icon: FeatureIconKey; text: string};

export type ProductReview = {
  id: string;
  /** Stars on a 0 to 5 scale; `null` when the review carries no valid rating. */
  rating: number | null;
  title: string | null;
  body: string;
  author: string;
  /** True only when the merchant explicitly marked the review as verified. */
  verified: boolean;
  date?: string | null;
};

/** Reward unlocked once the cart subtotal reaches `threshold` (shop currency). */
export type FreeGiftOffer = {
  threshold: number;
  /** What the shopper gets, e.g. "a free Silk Sleep Mask". */
  label: string;
  /** Discount code applied at checkout, shown once the threshold is met. */
  code: string | null;
};

/** A percentage shown as an animated ring: "95% sleep at their ideal temperature". */
export type ProofStat = {id: string; value: number; label: string};

export type SiteSettings = {
  announcements: string[];
  trustBadges: TrustBadge[];
  savingsNote: string;
  savingsExplanation: string;
  /** Title of the cart drawer; the blueprint frames it as "Your Sleep Stack". */
  cartHeading: string;
  /** Social-proof label beside five stars on banners: "124,952+ Happy Sleepers". */
  ratingLabel: string;
  /** The call-to-action card at the top of the footer. */
  footerCta: {heading: string; label: string; url: string};
  /** The footer's last line, e.g. "© Copyright MELLOW LLC". */
  copyright: string;
  freeGift: FreeGiftOffer | null;
  proofStats: ProofStat[];
};

/** A quantity tier offered in the buy box ("Pair · Most popular"). */
export type PackTier = {
  quantity: number;
  label: string;
  /** Short note under the label: "Most popular", "For the whole family". */
  note: string | null;
};

/** A one-click companion product offered inside the buy box. */
export type ProductAddon = {
  handle: string;
  title: string;
  variantId: string;
  availableForSale: boolean;
  price: {amount: string; currencyCode: CurrencyCode};
  image: ImageContent | null;
  /** Why it belongs in the box: "Ships on the pillow, already fitted." */
  note: string | null;
};

export type HomeContent = {
  hero: HeroContent;
  pressLogos: PressLogo[];
  story: StoryContent;
  featured: FeaturedProductsContent;
  ugc: UgcContent;
  lifestyle: LifestyleImage[];
  testimonials: TestimonialsContent;
  faq: FaqContent;
  newsletter: NewsletterContent;
};

export type AboutValue = {
  id: string;
  icon: FeatureIconKey;
  title: string;
  body: string;
};

export type AboutContent = {
  hero: {
    heading: string;
    subheading: string;
    cta: LinkContent;
    image: ImageContent | null;
  };
  story: {
    heading: string;
    body: string;
    /** Rendered in the brand colour after the body. */
    highlight: string | null;
  };
  imageLeft: ImageContent | null;
  imageBottom: ImageContent | null;
  values: AboutValue[];
  closing: {
    heading: string;
    body: string;
    cta: LinkContent;
  };
};
