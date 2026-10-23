import {Suspense} from 'react';
import {Await, Link, NavLink} from 'react-router';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';
import {Logo} from '~/components/ui/Logo';
import {FeatureIcon} from '~/components/ui/Icons';
import {NewsletterForm} from '~/components/NewsletterForm';
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

  const policyLinks = menu.items
    .flatMap((item) => [item, ...(item.items ?? [])])
    .filter((item) => item.type === 'SHOP_POLICY' && item.url);

  const year = new Date().getFullYear();

  return (
    <>
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <Logo
            logoUrl={header.shop.brand?.logo?.image?.url}
            shopName={header.shop.name}
          />
          <p className="site-footer__tagline">
            {header.shop.description ||
              'Pillows that align. Comforters that adapt. Smarter sleep essentials, designed for every night.'}
          </p>
          <ul className="site-footer__trust" aria-label="Guarantees">
            {siteSettings.trustBadges.map((badge) => (
              <li key={badge.label}>
                <FeatureIcon icon={badge.icon} size={18} />
                {badge.label}
              </li>
            ))}
          </ul>
        </div>

        {groups.slice(0, 3).map((group) => (
          <nav key={group.id} aria-labelledby={`footer-${group.id}`}>
            <h2 className="site-footer__heading" id={`footer-${group.id}`}>
              {group.title}
            </h2>
            <ul className="site-footer__links">
              {group.items.map((item) => {
                if (!item.url) return null;
                const url = toUrl(item.url);
                return (
                  <li key={item.id}>
                    {isExternalUrl(url) ? (
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
        ))}

        <div className="site-footer__newsletter">
          <h2 className="site-footer__heading" id="footer-newsletter">
            Sleep Smarter. Save More.
          </h2>
          <p className="site-footer__tagline" style={{marginBottom: '1rem'}}>
            Early access to launches, bundle savings and sleep tips.
          </p>
          <NewsletterForm id="footer" source="footer" />
        </div>
      </div>

      <div className="site-footer__bottom">
        <p>
          © {year} {header.shop.name}. All rights reserved.
        </p>
        <ul className="site-footer__policies">
          {policyLinks.length ? (
            policyLinks.map((item) => (
              <li key={item.id}>
                <Link to={toUrl(item.url!)}>{item.title}</Link>
              </li>
            ))
          ) : (
            <li>
              <Link to="/policies">Policies</Link>
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
