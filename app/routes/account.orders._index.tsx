import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from 'react-router';
import type {Route} from './+types/account.orders._index';
import {useId, useRef} from 'react';
import {Pagination, getPaginationVariables} from '~/lib/pagination';
import {Money, flattenConnection} from '@shopify/hydrogen-react';
import {
  buildOrderSearchQuery,
  parseOrderFilters,
  ORDER_FILTER_FIELDS,
  type OrderFilterParams,
} from '~/lib/orderFilters';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import type {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'customer-accountapi.generated';
import {Button} from '~/components/ui/Button';
import {OrderStatusBadge} from '~/components/account/OrderStatusBadge';
import {formatOrderDate} from '~/components/account/orderUtils';

type OrdersLoaderData = {
  customer: CustomerOrdersFragment;
  filters: OrderFilterParams;
};

export const meta: Route.MetaFunction = () => {
  return [{title: 'Orders | {AppName}'}];
};

export async function loader({request, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams);
  const query = buildOrderSearchQuery(filters);

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
      query,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw Error('Customer orders not found');
  }

  return {customer: data.customer, filters};
}

export default function Orders() {
  const {customer, filters} = useLoaderData<OrdersLoaderData>();
  const {orders} = customer;

  return (
    <div className="account-section orders">
      <header className="account-section__header">
        <h2>Orders</h2>
        <p className="text-muted">
          Track deliveries, review past purchases and find order details.
        </p>
      </header>
      <OrderSearchForm currentFilters={filters} />
      <OrdersTable orders={orders} filters={filters} />
    </div>
  );
}

function OrdersTable({
  orders,
  filters,
}: {
  orders: CustomerOrdersFragment['orders'];
  filters: OrderFilterParams;
}) {
  const hasFilters = !!(filters.name || filters.confirmationNumber);

  return (
    <div className="account-orders" aria-live="polite">
      {orders?.nodes.length ? (
        <Pagination connection={orders}>
          {({
            nodes,
            isLoading,
            PreviousLink,
            NextLink,
            hasPreviousPage,
            hasNextPage,
          }) => (
            <>
              {hasPreviousPage ? (
                <div className="account-pagination">
                  <PreviousLink className="btn btn--outline btn--sm">
                    {isLoading ? 'Loading…' : 'Load previous orders'}
                  </PreviousLink>
                </div>
              ) : null}
              <ul className="order-list">
                {nodes.map((order) => (
                  <OrderItem key={order.id} order={order} />
                ))}
              </ul>
              {hasNextPage ? (
                <div className="account-pagination">
                  <NextLink className="btn btn--outline btn--sm">
                    {isLoading ? 'Loading…' : 'Load more orders'}
                  </NextLink>
                </div>
              ) : null}
            </>
          )}
        </Pagination>
      ) : (
        <EmptyOrders hasFilters={hasFilters} />
      )}
    </div>
  );
}

function EmptyOrders({hasFilters = false}: {hasFilters?: boolean}) {
  return (
    <div className="empty-state">
      {hasFilters ? (
        <>
          <h3 className="empty-state__title">No orders match your search</h3>
          <p>Check the order or confirmation number and try again.</p>
          <Button to="/account/orders" variant="outline">
            Clear filters
          </Button>
        </>
      ) : (
        <>
          <h3 className="empty-state__title">No orders yet</h3>
          <p>
            When you place an order it will show up here with its tracking and
            receipt.
          </p>
          <Button to="/collections/all">Start shopping</Button>
        </>
      )}
    </div>
  );
}

function OrderSearchForm({
  currentFilters,
}: {
  currentFilters: OrderFilterParams;
}) {
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSearching =
    navigation.state !== 'idle' &&
    navigation.location?.pathname?.includes('orders');
  const formRef = useRef<HTMLFormElement>(null);
  const nameId = useId();
  const confirmationId = useId();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const name = formData.get(ORDER_FILTER_FIELDS.NAME)?.toString().trim();
    const confirmationNumber = formData
      .get(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER)
      ?.toString()
      .trim();

    if (name) params.set(ORDER_FILTER_FIELDS.NAME, name);
    if (confirmationNumber)
      params.set(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER, confirmationNumber);

    setSearchParams(params);
  };

  const hasFilters = currentFilters.name || currentFilters.confirmationNumber;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="orders-filter account-card"
      aria-label="Filter orders"
    >
      <div className="orders-filter__fields">
        <div className="field">
          <label htmlFor={nameId}>Order number</label>
          <input
            type="search"
            id={nameId}
            name={ORDER_FILTER_FIELDS.NAME}
            placeholder="e.g. 1001"
            defaultValue={currentFilters.name || ''}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor={confirmationId}>Confirmation number</label>
          <input
            type="search"
            id={confirmationId}
            name={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER}
            placeholder="e.g. ABC123XYZ"
            defaultValue={currentFilters.confirmationNumber || ''}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="orders-filter__actions">
        <Button type="submit" size="sm" loading={isSearching}>
          Search orders
        </Button>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSearching}
            onClick={() => {
              setSearchParams(new URLSearchParams());
              formRef.current?.reset();
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  const fulfillmentStatus =
    order.fulfillmentStatus ?? flattenConnection(order.fulfillments)[0]?.status;
  // Base64 can contain `/` and `+` (and `=`), none of which survive in a path
  // segment unescaped: a `/` would split the `:id` param.
  const href = `/account/orders/${encodeURIComponent(btoa(order.id))}`;

  return (
    <li className="order-card">
      <div className="order-card__main">
        <div className="order-card__heading">
          <h3 className="order-card__number">
            <Link to={href} prefetch="intent">
              Order #{order.number}
            </Link>
          </h3>
          <p className="order-card__date">
            Placed{' '}
            <time dateTime={order.processedAt}>
              {formatOrderDate(order.processedAt)}
            </time>
          </p>
        </div>
        <div className="order-card__badges">
          <OrderStatusBadge prefix="Payment" status={order.financialStatus} />
          <OrderStatusBadge prefix="Fulfillment" status={fulfillmentStatus} />
        </div>
      </div>

      <dl className="order-card__meta">
        {order.confirmationNumber ? (
          <div>
            <dt>Confirmation</dt>
            <dd>{order.confirmationNumber}</dd>
          </div>
        ) : null}
        <div>
          <dt>Total</dt>
          <dd className="order-card__total">
            <Money as="span" data={order.totalPrice} />
          </dd>
        </div>
      </dl>

      <div className="order-card__actions">
        <Button to={href} variant="outline" size="sm">
          View order
        </Button>
      </div>
    </li>
  );
}
