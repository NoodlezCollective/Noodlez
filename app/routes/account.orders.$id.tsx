import {Link, redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/account.orders.$id';
import {Money, Image} from '@shopify/hydrogen';
import type {
  OrderLineItemFullFragment,
  OrderQuery,
} from 'customer-accountapi.generated';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {Button} from '~/components/ui/Button';
import {ChevronLeftIcon} from '~/components/ui/Icons';
import {OrderStatusBadge} from '~/components/account/OrderStatusBadge';
import {formatOrderDate} from '~/components/account/orderUtils';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {
      title: data?.order?.name
        ? `Order ${data.order.name} | Mellow`
        : 'Order | Mellow',
    },
  ];
};

export async function loader({params, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  if (!params.id) {
    return redirect('/account/orders');
  }

  const orderId = atob(params.id);
  const {data, errors}: {data: OrderQuery; errors?: Array<{message: string}>} =
    await customerAccount.query(CUSTOMER_ORDER_QUERY, {
      variables: {
        orderId,
        language: customerAccount.i18n.language,
      },
    });

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  // Extract line items directly from nodes array
  const lineItems = order.lineItems.nodes;

  // Extract discount applications directly from nodes array
  const discountApplications = order.discountApplications.nodes;

  // Get fulfillment status from first fulfillment node
  const fulfillmentStatus = order.fulfillments.nodes[0]?.status ?? 'N/A';

  // Get first discount value with proper type checking
  const firstDiscount = discountApplications[0]?.value;

  // Type guard for MoneyV2 discount
  const discountValue =
    firstDiscount?.__typename === 'MoneyV2'
      ? (firstDiscount as Extract<
          typeof firstDiscount,
          {__typename: 'MoneyV2'}
        >)
      : null;

  // Type guard for percentage discount
  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue'
      ? (
          firstDiscount as Extract<
            typeof firstDiscount,
            {__typename: 'PricingPercentageValue'}
          >
        ).percentage
      : null;

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  };
}

export default function OrderRoute() {
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  } = useLoaderData<typeof loader>();
  const status =
    fulfillmentStatus && fulfillmentStatus !== 'N/A'
      ? fulfillmentStatus
      : order.fulfillmentStatus;
  const hasDiscount = Boolean(
    (discountValue && discountValue.amount) || discountPercentage,
  );
  const address = order.shippingAddress;

  return (
    <div className="account-section account-order">
      <Link className="account-back" to="/account/orders" prefetch="intent">
        <ChevronLeftIcon size={16} />
        Back to orders
      </Link>

      <header className="account-section__header account-order__header">
        <div>
          <h2>Order {order.name}</h2>
          <p className="text-muted">
            Placed{' '}
            <time dateTime={order.processedAt!}>
              {formatOrderDate(order.processedAt)}
            </time>
            {order.confirmationNumber ? (
              <> &middot; Confirmation {order.confirmationNumber}</>
            ) : null}
          </p>
        </div>
        <div className="order-card__badges">
          <OrderStatusBadge prefix="Fulfillment" status={status} />
        </div>
      </header>

      <div className="account-order__grid">
        <section
          className="account-card account-order__items"
          aria-label="Items"
        >
          <table className="order-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col" className="is-numeric">
                  Price
                </th>
                <th scope="col" className="is-numeric">
                  Qty
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((lineItem) => (
                <OrderLineRow key={lineItem.id} lineItem={lineItem} />
              ))}
            </tbody>
          </table>

          <dl className="order-totals">
            {hasDiscount ? (
              <div className="order-totals__row order-totals__row--discount">
                <dt>Discounts</dt>
                <dd>
                  {discountPercentage ? (
                    <span>−{discountPercentage}%</span>
                  ) : discountValue ? (
                    <>
                      −<Money as="span" data={discountValue} />
                    </>
                  ) : null}
                </dd>
              </div>
            ) : null}
            <div className="order-totals__row">
              <dt>Subtotal</dt>
              <dd>
                {order.subtotal ? (
                  <Money as="span" data={order.subtotal} />
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="order-totals__row">
              <dt>Tax</dt>
              <dd>
                {order.totalTax ? (
                  <Money as="span" data={order.totalTax} />
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="order-totals__row order-totals__row--total">
              <dt>Total</dt>
              <dd>
                <Money as="span" data={order.totalPrice} />
              </dd>
            </div>
          </dl>
        </section>

        <aside
          className="account-card account-order__aside"
          aria-label="Delivery"
        >
          <div className="account-order__block">
            <h3 className="account-card__subtitle">Shipping address</h3>
            {address ? (
              <address className="account-address">
                {(address.formatted.length
                  ? address.formatted
                  : [address.name, address.formattedArea].filter(Boolean)
                ).join('\n')}
              </address>
            ) : (
              <p className="text-muted">No shipping address on this order.</p>
            )}
          </div>

          <div className="account-order__block">
            <h3 className="account-card__subtitle">Status</h3>
            {status ? (
              <OrderStatusBadge status={status} />
            ) : (
              <p className="text-muted">Not available yet.</p>
            )}
          </div>

          {order.statusPageUrl ? (
            <Button
              href={order.statusPageUrl}
              rel="noreferrer"
              size="sm"
              target="_blank"
              variant="outline"
            >
              Track your order
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function OrderLineRow({lineItem}: {lineItem: OrderLineItemFullFragment}) {
  const discount = Number(lineItem.totalDiscount?.amount ?? 0);
  return (
    <tr>
      <td>
        <div className="order-table__product">
          <div className="order-table__media">
            {lineItem?.image ? (
              <Image
                alt={lineItem.image.altText || lineItem.title}
                aspectRatio="1/1"
                data={lineItem.image}
                height={64}
                sizes="64px"
                width={64}
              />
            ) : null}
          </div>
          <div className="order-table__details">
            <p className="order-table__title">{lineItem.title}</p>
            {lineItem.variantTitle &&
            lineItem.variantTitle !== 'Default Title' ? (
              <p className="order-table__variant">{lineItem.variantTitle}</p>
            ) : null}
            {discount > 0 ? (
              <p className="order-table__discount">
                Discount −<Money as="span" data={lineItem.totalDiscount} />
              </p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="is-numeric">
        {lineItem.price ? <Money as="span" data={lineItem.price} /> : '—'}
      </td>
      <td className="is-numeric">{lineItem.quantity}</td>
    </tr>
  );
}
