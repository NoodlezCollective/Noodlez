import {matchRoutes} from 'react-router';
import {describe, expect, it} from 'vitest';
import Orders from '../../routes/account.orders._index';
import {ORIGIN, renderRoute} from './route-test-utils';

const ORDER_GID = 'gid://shopify/Order/123456789012?key=abcdef0123456789';

// 12-digit order ids put the `?` of `...?key=` at a base64 triple boundary,
// which makes the token contain `/`.
describe('account orders: link token round trip', () => {
  it('premise: the base64 token of a 12-digit order id contains a slash', () => {
    expect(btoa(ORDER_GID)).toContain('/');
  });

  function renderOrders(orderId: string) {
    return renderRoute({
      path: '/account/orders',
      url: `${ORIGIN}/account/orders`,
      Component: Orders as never,
      loaderData: {
        filters: {},
        customer: {
          orders: {
            nodes: [
              {
                id: orderId,
                number: 1001,
                processedAt: '2026-09-12T10:00:00Z',
                financialStatus: 'PAID',
                fulfillmentStatus: 'FULFILLED',
                confirmationNumber: 'ABC123',
                totalPrice: {amount: '49.0', currencyCode: 'USD'},
                fulfillments: {nodes: []},
              },
            ],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: null,
              endCursor: null,
            },
          },
        },
      },
    });
  }

  it('escapes the token so it stays one path segment that routes to :id', async () => {
    // Arrange
    const html = await renderOrders(ORDER_GID);

    // Act
    const hrefs = [...html.matchAll(/href="(\/account\/orders\/[^"]+)"/g)].map(
      (match) => match[1].replace(/&amp;/g, '&'),
    );

    // Assert
    expect(hrefs.length).toBeGreaterThan(0);
    const expected = `/account/orders/${encodeURIComponent(btoa(ORDER_GID))}`;
    for (const href of hrefs) {
      expect(href).toBe(expected);
      expect(href.slice('/account/orders/'.length)).not.toContain('/');

      const [match] = matchRoutes([{path: '/account/orders/:id'}], href) ?? [];
      expect(match?.params.id).toBe(btoa(ORDER_GID));
    }
  });

  it('would not route if the token were left unescaped (the bug being fixed)', () => {
    const unescaped = `/account/orders/${btoa(ORDER_GID)}`;
    expect(matchRoutes([{path: '/account/orders/:id'}], unescaped)).toBeNull();
  });
});
