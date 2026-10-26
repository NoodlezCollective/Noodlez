import {Fragment} from 'react';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/pages.about';
import {ContentImage} from '~/components/ContentImage';
import {Button} from '~/components/ui/Button';
import {FeatureIcon} from '~/components/ui/Icons';
import {SectionHeading} from '~/components/ui/SectionHeading';
import {SHOPIFY_RESOURCES} from '~/lib/content/config';
import {ABOUT_CONTENT_QUERY, mapAboutContent} from '~/lib/content/metaobjects';

export const meta: Route.MetaFunction = ({data}) => {
  const title =
    data?.page?.seo?.title ??
    'About {AppName} | Sleep Was Broken. We Fixed It.';
  const description =
    data?.page?.seo?.description ?? data?.content.hero.subheading ?? '';
  return [
    {title},
    {name: 'description', content: description},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {
      tagName: 'link',
      rel: 'canonical',
      href: `${data?.origin ?? ''}/pages/about`,
    },
    {property: 'og:type', content: 'website'},
  ];
};

/**
 * The About page is a designed template. Copy and imagery come from the
 * `mellow_about` metaobject (falling back to defaults) and, when a Shopify
 * page with the `about` handle exists, its body is rendered as well.
 */
export async function loader({context, request}: Route.LoaderArgs) {
  const {storefront} = context;
  const [aboutData, pageData] = await Promise.all([
    storefront
      .query(ABOUT_CONTENT_QUERY, {cache: storefront.CacheLong()})
      .catch((error: Error) => {
        console.error(error);
        return null;
      }),
    storefront
      .query(ABOUT_PAGE_QUERY, {
        cache: storefront.CacheLong(),
        variables: {handle: SHOPIFY_RESOURCES.aboutPageHandle},
      })
      .catch((error: Error) => {
        console.error(error);
        return null;
      }),
  ]);

  return {
    origin: new URL(request.url).origin,
    content: mapAboutContent(aboutData),
    page: pageData?.page ?? null,
  };
}

export default function AboutPage() {
  const {content, page} = useLoaderData<typeof loader>();
  const heroLines = content.hero.heading.split('\n').filter(Boolean);

  return (
    <div className="about">
      <section
        className="container"
        style={{paddingTop: '1.5rem'}}
        aria-labelledby="about-hero-heading"
      >
        <div className="about-hero">
          <div className="about-hero__content">
            <h1 id="about-hero-heading" className="about-hero__heading">
              {heroLines.map((line, index) => (
                <Fragment key={line}>
                  {line}
                  {index < heroLines.length - 1 ? <br /> : null}
                </Fragment>
              ))}
            </h1>
            <p className="about-hero__sub">{content.hero.subheading}</p>
            <Button to={content.hero.cta.url}>{content.hero.cta.label}</Button>
          </div>
          <div className="about-hero__media">
            {content.hero.image ? (
              <ContentImage
                image={content.hero.image}
                sizes="(min-width: 64em) 60vw, 100vw"
                loading="eager"
                fetchPriority="high"
              />
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="section section--tight"
        aria-labelledby="about-story-heading"
      >
        <div className="container about-story">
          {content.imageLeft ? (
            <div className="about-story__image-left">
              <ContentImage
                image={content.imageLeft}
                sizes="(min-width: 64em) 50vw, 100vw"
              />
            </div>
          ) : null}
          <div className="about-story__card">
            <h2 id="about-story-heading">{content.story.heading}</h2>
            <p>
              {content.story.body}{' '}
              {content.story.highlight ? (
                <span className="about-story__highlight">
                  {content.story.highlight}
                </span>
              ) : null}
            </p>
          </div>
          {content.imageBottom ? (
            <div className="about-story__image-bottom">
              <ContentImage
                image={content.imageBottom}
                sizes="(min-width: 64em) 50vw, 100vw"
              />
            </div>
          ) : null}
        </div>
      </section>

      {content.values.length ? (
        <section
          className="section section--tight"
          aria-labelledby="about-values-heading"
        >
          <div className="container">
            <SectionHeading
              id="about-values-heading"
              title="What we stand for"
            />
            <ul className="values-grid">
              {content.values.map((value) => (
                <li className="value-card" key={value.id}>
                  <span className="value-card__icon">
                    <FeatureIcon icon={value.icon} size={22} />
                  </span>
                  <h3 className="value-card__title">{value.title}</h3>
                  <p className="text-muted">{value.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {page?.body ? (
        <section className="section section--tight" aria-label={page.title}>
          <div className="container">
            <div
              className="prose"
              style={{marginInline: 'auto'}}
              dangerouslySetInnerHTML={{__html: page.body}}
            />
          </div>
        </section>
      ) : null}

      <section
        className="section section--tight"
        aria-labelledby="about-cta-heading"
      >
        <div className="container">
          <div className="cta-band">
            <h2 id="about-cta-heading">{content.closing.heading}</h2>
            <p>{content.closing.body}</p>
            <Button to={content.closing.cta.url} variant="light" size="lg">
              {content.closing.cta.label}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

const ABOUT_PAGE_QUERY = `#graphql
  query AboutPage(
    $language: LanguageCode
    $country: CountryCode
    $handle: String!
  ) @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      id
      handle
      title
      body
      seo {
        description
        title
      }
    }
  }
` as const;
