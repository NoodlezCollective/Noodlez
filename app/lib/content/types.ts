/**
 * Typed content contracts for the Mellow storefront.
 *
 * Everything that is not core Shopify commerce data (products, collections,
 * cart) is modelled here explicitly. Content is sourced from Shopify
 * metaobjects / metafields (see metaobjects.ts and metafields.ts) and falls
 * back to the defaults in defaults.ts so the storefront renders the documented
 * design before a merchant has configured Shopify.
 */
import type {FeatureIconKey} from '~/components/ui/Icons';

export type ImageContent = {
  url: string;
  altText: string | null;
  width?: number | null;
  height?: number | null;
};

export type VideoSource = {url: string; mimeType: string};

export type VideoContent = {
  sources: VideoSource[];
  poster: ImageContent | null;
  /** YouTube/Vimeo URL when the video is hosted externally. */
  externalUrl?: string | null;
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
  rating: number;
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

export type ProductFeature = {icon: FeatureIconKey | string; text: string};

export type ProductReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  author: string;
  verified: boolean;
  date?: string | null;
};

export type SiteSettings = {
  announcements: string[];
  trustBadges: TrustBadge[];
  savingsNote: string;
  savingsExplanation: string;
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
