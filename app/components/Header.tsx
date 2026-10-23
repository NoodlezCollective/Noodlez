import {Suspense} from 'react';
import {Await, NavLink, useAsyncValue} from 'react-router';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {Logo} from '~/components/ui/Logo';
import {CartIcon, MenuIcon, SearchIcon, UserIcon} from '~/components/ui/Icons';
import {
  FALLBACK_HEADER_MENU,
  isExternalUrl,
  normalizeMenuUrl,
} from '~/lib/menu';

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

/**
 * Sticky lavender header: primary navigation (left), wordmark (center) and
 * account / search / cart actions (right). On small screens the navigation
 * moves into the mobile drawer behind the menu button.
 */
export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop, menu} = header;
  const {open, type: asideType} = useAside();
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <button
          className="icon-btn site-header__mobile-toggle"
          onClick={() => open('mobile')}
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={asideType === 'mobile'}
        >
          <MenuIcon />
        </button>
        <HeaderMenu
          menu={menu}
          viewport="desktop"
          primaryDomainUrl={shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
        <div className="site-header__logo">
          <Logo logoUrl={shop.brand?.logo?.image?.url} shopName={shop.name} />
        </div>
        <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
      </div>
    </header>
  );
}

export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
  isLoggedIn,
}: {
  menu: HeaderProps['header']['menu'];
  primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
  isLoggedIn?: Promise<boolean>;
}) {
  const {close, open} = useAside();
  const items = (menu || FALLBACK_HEADER_MENU).items.filter((item) => item.url);

  if (viewport === 'mobile') {
    return (
      <nav className="mobile-nav" aria-label="Primary">
        <NavLink
          end
          onClick={close}
          prefetch="intent"
          className={({isActive}) =>
            `mobile-nav__link ${isActive ? 'is-active' : ''}`
          }
          to="/"
        >
          Home
        </NavLink>
        {items.map((item) => {
          const url = normalizeMenuUrl(
            item.url!,
            publicStoreDomain,
            primaryDomainUrl,
          );
          return isExternalUrl(url) ? (
            <a
              className="mobile-nav__link"
              href={url}
              key={item.id}
              onClick={close}
            >
              {item.title}
            </a>
          ) : (
            <NavLink
              className={({isActive}) =>
                `mobile-nav__link ${isActive ? 'is-active' : ''}`
              }
              end
              key={item.id}
              onClick={close}
              prefetch="intent"
              to={url}
            >
              {item.title}
            </NavLink>
          );
        })}
        <div className="mobile-nav__footer">
          <button
            className="mobile-nav__secondary"
            onClick={() => open('search')}
            type="button"
          >
            <SearchIcon size={20} /> Search
          </button>
          <NavLink
            className="mobile-nav__secondary"
            to="/account"
            onClick={close}
          >
            <UserIcon size={20} />
            {isLoggedIn ? (
              <Suspense fallback="Sign in">
                <Await resolve={isLoggedIn} errorElement="Sign in">
                  {(loggedIn) => (loggedIn ? 'My account' : 'Sign in')}
                </Await>
              </Suspense>
            ) : (
              'Sign in'
            )}
          </NavLink>
        </div>
      </nav>
    );
  }

  return (
    <nav className="site-header__nav" aria-label="Primary">
      {items.map((item) => {
        const url = normalizeMenuUrl(
          item.url!,
          publicStoreDomain,
          primaryDomainUrl,
        );
        return isExternalUrl(url) ? (
          <a className="nav-link" href={url} key={item.id}>
            {item.title}
          </a>
        ) : (
          <NavLink
            className={({isActive, isPending}) =>
              `nav-link ${isActive ? 'is-active' : ''} ${isPending ? 'is-pending' : ''}`
            }
            end
            key={item.id}
            prefetch="intent"
            to={url}
          >
            {item.title}
          </NavLink>
        );
      })}
    </nav>
  );
}

function HeaderCtas({
  isLoggedIn,
  cart,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'>) {
  return (
    <nav className="site-header__actions" aria-label="Account and cart">
      <Suspense fallback={<AccountLink label="Sign in" />}>
        <Await
          resolve={isLoggedIn}
          errorElement={<AccountLink label="Sign in" />}
        >
          {(loggedIn) => (
            <AccountLink label={loggedIn ? 'My account' : 'Sign in'} />
          )}
        </Await>
      </Suspense>
      <SearchToggle />
      <CartToggle cart={cart} />
    </nav>
  );
}

function AccountLink({label}: {label: string}) {
  return (
    <NavLink
      prefetch="intent"
      to="/account"
      className="icon-btn site-header__account"
      aria-label={label}
      title={label}
    >
      <UserIcon />
    </NavLink>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button
      className="icon-btn"
      onClick={() => open('search')}
      aria-label="Search"
      aria-haspopup="dialog"
    >
      <SearchIcon />
    </button>
  );
}

function CartBadge({count}: {count: number}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <a
      href="/cart"
      className="icon-btn cart-toggle"
      aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        } as CartViewPayload);
      }}
    >
      <CartIcon />
      {count > 0 ? (
        <span className="cart-toggle__count" aria-hidden="true">
          {count}
        </span>
      ) : null}
    </a>
  );
}

function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  return (
    <Suspense fallback={<CartBadge count={0} />}>
      <Await resolve={cart} errorElement={<CartBadge count={0} />}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}
