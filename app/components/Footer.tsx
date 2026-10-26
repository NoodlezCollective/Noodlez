import {Suspense} from 'react';
import {Await, NavLink} from 'react-router';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';
import {Button} from '~/components/ui/Button';
import {
  ArrowRightIcon,
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
} from '~/components/ui/Icons';
import {Stars} from '~/components/ui/Stars';
import type {SiteSettings} from '~/lib/content/types';
import {
  FALLBACK_FOOTER_MENU,
  isExternalUrl,
  normalizeMenuUrl,
  type MenuItemLike,
} from '~/lib/menu';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
  siteSettings: SiteSettings;
}

/**
 * Deep indigo footer: a social-proof call to action card, the footer menu's
 * groups as ruled columns (a group titled "Social" renders as icons), the
 * wordmark as a giant watermark and the copyright line.
 */
export function Footer({
  footer: footerPromise,
  header,
  publicStoreDomain,
  siteSettings,
}: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="container">
        <Suspense
          fallback={
            <FooterContent
              menu={FALLBACK_FOOTER_MENU}
              header={header}
              publicStoreDomain={publicStoreDomain}
              siteSettings={siteSettings}
            />
          }
        >
          <Await resolve={footerPromise}>
            {(footer) => (
              <FooterContent
                menu={footer?.menu ?? FALLBACK_FOOTER_MENU}
                header={header}
                publicStoreDomain={publicStoreDomain}
                siteSettings={siteSettings}
              />
            )}
          </Await>
        </Suspense>
      </div>
    </footer>
  );
}

function SocialIcon({title}: {title: string}) {
  const key = title.toLowerCase();
  if (key.includes('instagram')) return <InstagramIcon size={20} />;
  if (key.includes('facebook')) return <FacebookIcon size={20} />;
  if (key.includes('tiktok')) return <TikTokIcon size={20} />;
  return <ArrowRightIcon size={20} />;
}

function FooterContent({
  menu,
  header,
  publicStoreDomain,
  siteSettings,
}: {
  menu: NonNullable<FooterQuery['menu']>;
  header: HeaderQuery;
  publicStoreDomain: string;
  siteSettings: SiteSettings;
}) {
  const primaryDomainUrl = header.shop.primaryDomain?.url ?? '';
  const toUrl = (url: string) =>
    normalizeMenuUrl(url, publicStoreDomain, primaryDomainUrl);

  const hasGroups = menu.items.some((item) => item.items?.length);
  const groups: Array<{id: string; title: string; items: MenuItemLike[]}> =
    hasGroups
      ? menu.items
          .filter((item) => item.items?.length)
          .map((item) => ({
            id: item.id,
            title: item.title,
            items: item.items ?? [],
          }))
      : [{id: 'links', title: 'Explore', items: menu.items}];

  const {footerCta, ratingLabel, copyright} = siteSettings;

  return (
    <>
      <div className="footer-cta">
        <div className="footer-cta__body">
          <Stars rating={5} label={ratingLabel} size="sm" />
          <p className="footer-cta__heading">{footerCta.heading}</p>
        </div>
        <Button to={footerCta.url} variant="light" prefetch="viewport">
          {footerCta.label}
        </Button>
      </div>

      <div className="site-footer__columns">
        {groups.map((group) => {
          const isSocial = group.title.trim().toLowerCase() === 'social';
          return (
            <nav key={group.id} aria-labelledby={`footer-${group.id}`}>
              <h2 className="site-footer__heading" id={`footer-${group.id}`}>
                {group.title}
              </h2>
              <ul
                className={
                  isSocial ? 'site-footer__social' : 'site-footer__links'
                }
              >
                {group.items.map((item) => {
                  if (!item.url) return null;
                  const url = toUrl(item.url);
                  const external = isExternalUrl(url);
                  if (isSocial) {
                    return (
                      <li key={item.id}>
                        <a
                          className="site-footer__social-link"
                          href={url}
                          aria-label={item.title}
                          title={item.title}
                          rel={external ? 'noopener noreferrer' : undefined}
                          target={external ? '_blank' : undefined}
                        >
                          <SocialIcon title={item.title} />
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={item.id}>
                      {external ? (
                        <a href={url} rel="noopener noreferrer" target="_blank">
                          {item.title}
                        </a>
                      ) : (
                        <NavLink prefetch="intent" to={url}>
                          {item.title}
                        </NavLink>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          );
        })}
      </div>

      {/* Sized by character count so any shop name fills the width once. */}
      <p
        className="site-footer__watermark"
        aria-hidden="true"
        style={
          {
            '--watermark-chars': Math.max(4, header.shop.name.length),
          } as React.CSSProperties
        }
      >
        {header.shop.name}
      </p>

      <div className="site-footer__bottom">
        <p>{copyright}</p>
      </div>
    </>
  );
}
