import {Await, useLocation} from 'react-router';
import {Suspense, useEffect, useId, useRef, useState} from 'react';
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from 'storefrontapi.generated';
import type {SiteSettings} from '~/lib/content/types';
import {Aside} from '~/components/Aside';
import {AnnouncementBar} from '~/components/AnnouncementBar';
import {DevNotice} from '~/components/DevNotice';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {
  SEARCH_ENDPOINT,
  SearchFormPredictive,
} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import {Button} from '~/components/ui/Button';
import {SearchIcon} from '~/components/ui/Icons';

export interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  siteSettings: SiteSettings;
  isMockStorefront?: boolean;
  children?: React.ReactNode;
}

export function PageLayout({
  cart,
  children = null,
  footer,
  header,
  isLoggedIn,
  publicStoreDomain,
  siteSettings,
  isMockStorefront = false,
}: PageLayoutProps) {
  return (
    <Aside.Provider>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AnnouncementBar messages={siteSettings.announcements} />
      {header && (
        <Header
          header={header}
          cart={cart}
          isLoggedIn={isLoggedIn}
          publicStoreDomain={publicStoreDomain}
        />
      )}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer
        footer={footer}
        header={header}
        publicStoreDomain={publicStoreDomain}
        siteSettings={siteSettings}
      />
      <CartAside cart={cart} heading={siteSettings.cartHeading} />
      <SearchAside />
      <MobileMenuAside
        header={header}
        publicStoreDomain={publicStoreDomain}
        isLoggedIn={isLoggedIn}
      />
      {/* After the drawers: when a navigation also closes a drawer, the focus
          the drawer restores to its opener must not win over <main>. */}
      <RouteAnnouncer />
      {isMockStorefront ? <DevNotice /> : null}
    </Aside.Provider>
  );
}

/**
 * Client-side navigations do not reload the page, so nothing tells a screen
 * reader user that the page changed and keyboard focus is left on the (now
 * removed) link. After every pathname change this announces the new document
 * title and moves focus to <main> (`tabIndex={-1}`, no outline), so the next
 * Tab continues at the top of the new content. The first render (initial
 * load) and search-param-only changes (filters, sorting, "Load more", variant
 * selection) do neither.
 */
function RouteAnnouncer() {
  const {pathname} = useLocation();
  const previousPathname = useRef(pathname);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    setAnnouncement(document.title);
    document.getElementById('main-content')?.focus({preventScroll: true});
  }, [pathname]);

  return (
    <div
      id="route-announcer"
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {announcement}
    </div>
  );
}

function CartAside({
  cart,
  heading,
}: {
  cart: PageLayoutProps['cart'];
  heading: string;
}) {
  return (
    <Aside type="cart" heading={heading}>
      <Suspense fallback={<p className="text-muted">Loading cart…</p>}>
        <Await resolve={cart} errorElement={<CartLoadError />}>
          {(cart) => <CartMain cart={cart} layout="aside" />}
        </Await>
      </Suspense>
    </Aside>
  );
}

function CartLoadError() {
  return (
    <div className="empty-state">
      <p className="empty-state__title">We couldn’t load your cart</p>
      <p>Please refresh the page and try again.</p>
    </div>
  );
}

function SearchAside() {
  const queriesDatalistId = useId();
  return (
    <Aside type="search" heading="Search">
      <div className="predictive-search">
        <SearchFormPredictive>
          {({fetchResults, goToSearch, inputRef}) => (
            <div className="predictive-search__field">
              <label className="sr-only" htmlFor="predictive-search-input">
                Search products
              </label>
              <SearchIcon className="predictive-search__icon" size={20} />
              <input
                id="predictive-search-input"
                name="q"
                onChange={fetchResults}
                onFocus={fetchResults}
                placeholder="Search pillows, comforters, bundles…"
                ref={inputRef}
                type="search"
                list={queriesDatalistId}
                autoComplete="off"
              />
              <Button size="sm" onClick={goToSearch} type="button">
                Search
              </Button>
            </div>
          )}
        </SearchFormPredictive>

        <SearchResultsPredictive>
          {({items, total, term, state, closeSearch}) => {
            const {articles, collections, pages, products, queries} = items;

            if (state === 'loading' && term.current) {
              return <p className="predictive-search__status">Searching…</p>;
            }

            if (!total) {
              return <SearchResultsPredictive.Empty term={term} />;
            }

            return (
              <>
                <SearchResultsPredictive.Queries
                  queries={queries}
                  queriesDatalistId={queriesDatalistId}
                />
                <SearchResultsPredictive.Products
                  products={products}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Collections
                  collections={collections}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Pages
                  pages={pages}
                  closeSearch={closeSearch}
                  term={term}
                />
                <SearchResultsPredictive.Articles
                  articles={articles}
                  closeSearch={closeSearch}
                  term={term}
                />
                {term.current && total ? (
                  <Button
                    variant="outline"
                    block
                    onClick={closeSearch}
                    to={`${SEARCH_ENDPOINT}?q=${encodeURIComponent(term.current)}`}
                  >
                    View all results for “{term.current}”
                  </Button>
                ) : null}
              </>
            );
          }}
        </SearchResultsPredictive>
      </div>
    </Aside>
  );
}

function MobileMenuAside({
  header,
  publicStoreDomain,
  isLoggedIn,
}: {
  header: PageLayoutProps['header'];
  publicStoreDomain: PageLayoutProps['publicStoreDomain'];
  isLoggedIn: PageLayoutProps['isLoggedIn'];
}) {
  return (
    header.shop.primaryDomain?.url && (
      <Aside type="mobile" heading="Menu">
        <HeaderMenu
          menu={header.menu}
          viewport="mobile"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
          isLoggedIn={isLoggedIn}
        />
      </Aside>
    )
  );
}
