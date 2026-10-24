/**
 * Fallback storefront content.
 *
 * Copy is transcribed from the Mellow design references. Imagery uses local
 * placeholder artwork (public/images/placeholders) because the reference
 * photography is not part of this repository; merchants replace it by
 * creating the metaobjects documented in docs/shopify-setup.md.
 */
import {SHOPIFY_RESOURCES} from './config';
import type {
  AboutContent,
  HomeContent,
  SiteSettings,
  TrustBadge,
} from './types';

const PLACEHOLDER = '/images/placeholders';

export const DEFAULT_TRUST_BADGES: TrustBadge[] = [
  {icon: 'shield', label: '30-Day Trial'},
  {icon: 'truck', label: 'Hassle-Free Returns'},
];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  announcements: ['Up to 50% Off Sitewide', 'Save More When You Bundle'],
  trustBadges: DEFAULT_TRUST_BADGES,
  savingsNote: 'Savings based on comparable value.',
  savingsExplanation:
    'Compare-at prices reflect the comparable retail value of similar bedding sold at full price. Your savings are the difference between that value and the Mellow price.',
};

export const DEFAULT_HOME_CONTENT: HomeContent = {
  hero: {
    ratingLabel: '124,952+ Happy Sleepers',
    rating: 5,
    headline: 'Shop Premium\nCooling Comforters\n& Pillows For Better Sleep',
    subheadline:
      'Pillows that align. Comforters that adapt. Smarter sleep essentials, designed for every night.',
    cta: {label: 'Shop Now', url: '/collections/all'},
    image: {
      url: `${PLACEHOLDER}/hero.svg`,
      altText:
        'Three friends relaxing on a bed layered with Mellow pillows and comforters',
      width: 1600,
      height: 900,
    },
  },
  pressLogos: [
    {id: 'usa-today', name: 'USA Today', image: null},
    {id: 'scary-mommy', name: 'Scary Mommy', image: null},
    {id: 'readers-digest', name: "Reader's Digest", image: null},
    {id: 'forbes', name: 'Forbes', image: null},
    {id: 'life-style', name: 'Life & Style', image: null},
    {id: 'us-weekly', name: 'Us Weekly', image: null},
  ],
  story: {
    heading: 'Redefining Sleep. One Innovation At A Time.',
    body: "Mellow started with a comforter that changed everything. Now, we're building a new standard for sleep with more innovative fabrics, dual-sided cooling, cloud-like pillows and effortless design. Sleep shouldn't be complicated. It should just feel right.",
    video: {
      sources: [],
      poster: {
        url: `${PLACEHOLDER}/story-poster.svg`,
        altText: 'Mellow brand film',
        width: 1336,
        height: 750,
      },
    },
    cta: {label: 'Our Story', url: '/pages/about'},
  },
  featured: {
    heading: 'Explore Our Most Loved Sleep Products',
    subheading:
      'From adaptive comforters to cloud-like pillows, every Mellow product is designed to make sleep effortless.',
    collectionHandle: SHOPIFY_RESOURCES.featuredCollectionHandle,
    ctaLabel: 'Shop Now',
  },
  ugc: {
    heading: 'Sleep Better With Mellow',
    subheading: 'Watch why everyone is making the switch to mellow!',
    videos: [
      {
        id: 'ugc-1',
        title: 'Does your pillow do this? A chiropractor tests the CloudAlign.',
        video: null,
        poster: {
          url: `${PLACEHOLDER}/ugc-1.svg`,
          altText: 'Chiropractor demonstrating the CloudAlign pillow',
          width: 670,
          height: 1114,
        },
        productHandle: 'cloudalign-pillow',
      },
      {
        id: 'ugc-2',
        title: 'This is the dual sided comforter.',
        video: null,
        poster: {
          url: `${PLACEHOLDER}/ugc-2.svg`,
          altText: 'Customer unfolding the dual-sided CloudCool comforter',
          width: 670,
          height: 1114,
        },
        productHandle: 'cloudcool-cooling-comforter',
      },
      {
        id: 'ugc-3',
        title: 'I kept my mellow pillow.',
        video: null,
        poster: {
          url: `${PLACEHOLDER}/ugc-3.svg`,
          altText: 'Customer holding a Mellow pillow',
          width: 670,
          height: 1114,
        },
        productHandle: 'cloudalign-pillow',
      },
      {
        id: 'ugc-4',
        title: 'No more hassling to put your duvet cover on again.',
        video: null,
        poster: {
          url: `${PLACEHOLDER}/ugc-4.svg`,
          altText: 'Customer with the CloudControl comforter',
          width: 670,
          height: 1114,
        },
        productHandle: 'cloudcontrol-comforter',
      },
    ],
  },
  lifestyle: [
    {
      id: 'lifestyle-1',
      url: `${PLACEHOLDER}/lifestyle-1.svg`,
      altText: 'Woman smiling while resting on a stack of Mellow pillows',
      width: 1376,
      height: 760,
      caption: null,
    },
    {
      id: 'lifestyle-2',
      url: `${PLACEHOLDER}/lifestyle-2.svg`,
      altText: 'Close-up of the MarshMellow comforter fabric',
      width: 1376,
      height: 760,
      caption: null,
    },
  ],
  // Ratings are explicit on purpose: a testimonial without one renders no
  // stars, so these placeholders must carry the stars they should show.
  testimonials: {
    heading: 'Loved By 124,952+ Sleepers',
    subheading: 'Real reviews from people who stopped fighting their bedding.',
    items: [
      {
        id: 't-1',
        quote:
          'I wake up without neck pain for the first time in years. The CloudAlign actually keeps my head where it should be.',
        author: 'Jenna R.',
        rating: 5,
        productTitle: 'CloudAlign Pillow',
        productHandle: 'cloudalign-pillow',
      },
      {
        id: 't-2',
        quote:
          'The cool side is genuinely cool. I flip it in summer and my partner keeps the plush side. We finally agree on a comforter.',
        author: 'Marcus T.',
        rating: 5,
        productTitle: 'CloudCool Cooling Comforter',
        productHandle: 'cloudcool-cooling-comforter',
      },
      {
        id: 't-3',
        quote:
          'It washed beautifully and came out of the dryer just as fluffy. Hotel-bed feel at home.',
        author: 'Priya S.',
        rating: 5,
        productTitle: 'MarshMellow Comforter',
        productHandle: 'marshmellow-comforter',
      },
    ],
  },
  faq: {
    heading: 'Questions, Answered',
    items: [
      {
        id: 'faq-1',
        question: 'How does the 30-day trial work?',
        answer:
          'Sleep on any Mellow product for 30 nights. If it is not the best sleep you have had, start a return from your account and we will make it right.',
      },
      {
        id: 'faq-2',
        question: 'Are Mellow comforters and pillows machine washable?',
        answer:
          'Yes. Every comforter and pillow cover is designed to be washed at home on a gentle cycle and tumble dried low.',
      },
      {
        id: 'faq-3',
        question: 'Which side of the CloudCool comforter is the cool side?',
        answer:
          'The smooth, silk-touch side is the cooling side. The soft knit side is for cooler nights. Flip it whenever you like.',
      },
      {
        id: 'faq-4',
        question: 'How long does shipping take?',
        answer:
          'Orders ship within 1-2 business days and typically arrive in 3-6 business days. Tracking is emailed as soon as your order leaves our warehouse.',
      },
    ],
  },
  newsletter: {
    heading: 'Sleep Smarter. Save More.',
    body: 'Join the Mellow list for early access to launches, bundle savings and sleep tips.',
    placeholder: 'Enter your email',
    ctaLabel: 'Sign Up',
  },
};

export const DEFAULT_ABOUT_CONTENT: AboutContent = {
  hero: {
    heading: 'Sleep Was Broken.\nWe Fixed It.',
    subheading:
      'Bedding and sleepwear, done right. Engineered for better sleep.',
    cta: {label: 'Shop Now', url: '/collections/all'},
    image: {
      url: `${PLACEHOLDER}/about-hero.svg`,
      altText: 'Woman resting on a Mellow pillow',
      width: 900,
      height: 450,
    },
  },
  story: {
    heading: 'How mellow was created to redefine sleep',
    body: 'Most comforters make you choose: too hot or too cold, too heavy or too light, impossible to wash or just plain uncomfortable.',
    highlight: "It shouldn't be this complicated.",
  },
  imageLeft: {
    url: `${PLACEHOLDER}/about-left.svg`,
    altText: 'Woman smiling while resting on Mellow pillows',
    width: 688,
    height: 560,
  },
  imageBottom: {
    url: `${PLACEHOLDER}/about-bottom.svg`,
    altText: 'Hand pressing into a Mellow comforter',
    width: 688,
    height: 300,
  },
  values: [
    {
      id: 'value-1',
      icon: 'snowflake',
      title: 'Engineered for every sleeper',
      body: 'Dual-sided fabrics, adaptive fills and ergonomic shapes so hot sleepers, cold sleepers and side sleepers all get their best night.',
    },
    {
      id: 'value-2',
      icon: 'wash',
      title: 'Washable by design',
      body: 'Everything we make survives the washing machine and comes out fluffy. Bedding should be easy to love and easy to clean.',
    },
    {
      id: 'value-3',
      icon: 'moon',
      title: 'Tested by 124,952+ sleepers',
      body: 'We iterate on real feedback, from award-winning pillows to the comforter that started it all.',
    },
  ],
  closing: {
    heading: 'Ready to sleep mellow?',
    body: 'Try any product for 30 nights. If you do not sleep better, returns are on us.',
    cta: {label: 'Shop Best Sellers', url: '/collections/all'},
  },
};
