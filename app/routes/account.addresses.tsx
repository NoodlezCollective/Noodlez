import type {CustomerAddressInput} from '@shopify/hydrogen-react/customer-account-api-types';
import type {
  AddressFragment,
  CustomerFragment,
} from 'customer-accountapi.generated';
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
  type Fetcher,
} from 'react-router';
import {useId} from 'react';
import type {Route} from './+types/account.addresses';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';
import {Badge} from '~/components/ui/Badge';
import {Button} from '~/components/ui/Button';
import {PlusIcon} from '~/components/ui/Icons';

export type ActionResponse = {
  addressId?: string | null;
  createdAddress?: AddressFragment;
  defaultAddress?: string | null;
  deletedAddress?: string | null;
  error: Record<AddressFragment['id'], string> | null;
  updatedAddress?: AddressFragment;
};

export const meta: Route.MetaFunction = () => {
  return [{title: 'Addresses | Mellow'}];
};

export async function loader({context}: Route.LoaderArgs) {
  await context.customerAccount.handleAuthStatus();

  return {};
}

export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;

  try {
    const form = await request.formData();

    const addressId = form.has('addressId')
      ? String(form.get('addressId'))
      : null;
    if (!addressId) {
      throw new Error('You must provide an address id.');
    }

    // this will ensure redirecting to login never happen for mutatation
    const isLoggedIn = await customerAccount.isLoggedIn();
    if (!isLoggedIn) {
      return data(
        {error: {[addressId]: 'Unauthorized'}},
        {
          status: 401,
        },
      );
    }

    const defaultAddress = form.has('defaultAddress')
      ? String(form.get('defaultAddress')) === 'on'
      : false;
    const address: CustomerAddressInput = {};
    const keys: (keyof CustomerAddressInput)[] = [
      'address1',
      'address2',
      'city',
      'company',
      'territoryCode',
      'firstName',
      'lastName',
      'phoneNumber',
      'zoneCode',
      'zip',
    ];

    for (const key of keys) {
      const value = form.get(key);
      if (typeof value === 'string') {
        address[key] = value;
      }
    }

    switch (request.method) {
      case 'POST': {
        // handle new address creation
        try {
          const {data, errors} = await customerAccount.mutate(
            CREATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressCreate?.userErrors?.length) {
            throw new Error(data?.customerAddressCreate?.userErrors[0].message);
          }

          if (!data?.customerAddressCreate?.customerAddress) {
            throw new Error('Customer address create failed.');
          }

          return {
            error: null,
            createdAddress: data?.customerAddressCreate?.customerAddress,
            defaultAddress,
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'PUT': {
        // handle address updates
        try {
          const {data, errors} = await customerAccount.mutate(
            UPDATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                addressId: decodeURIComponent(addressId),
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressUpdate?.userErrors?.length) {
            throw new Error(data?.customerAddressUpdate?.userErrors[0].message);
          }

          if (!data?.customerAddressUpdate?.customerAddress) {
            throw new Error('Customer address update failed.');
          }

          return {
            error: null,
            updatedAddress: address,
            defaultAddress,
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'DELETE': {
        // handles address deletion
        try {
          const {data, errors} = await customerAccount.mutate(
            DELETE_ADDRESS_MUTATION,
            {
              variables: {
                addressId: decodeURIComponent(addressId),
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressDelete?.userErrors?.length) {
            throw new Error(data?.customerAddressDelete?.userErrors[0].message);
          }

          if (!data?.customerAddressDelete?.deletedAddressId) {
            throw new Error('Customer address delete failed.');
          }

          return {error: null, deletedAddress: addressId};
        } catch (error: unknown) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      default: {
        return data(
          {error: {[addressId]: 'Method not allowed'}},
          {
            status: 405,
          },
        );
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return data(
        {error: error.message},
        {
          status: 400,
        },
      );
    }
    return data(
      {error},
      {
        status: 400,
      },
    );
  }
}

export default function Addresses() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const {defaultAddress, addresses} = customer;
  const savedHeadingId = useId();

  return (
    <div className="account-section account-addresses">
      <header className="account-section__header">
        <h2>Addresses</h2>
        <p className="text-muted">
          Save the places you ship to for a faster checkout.
        </p>
      </header>

      <section aria-labelledby={savedHeadingId}>
        <h3 id={savedHeadingId} className="sr-only">
          Saved addresses
        </h3>
        {!addresses.nodes.length ? (
          <p className="text-muted address-empty">
            You haven&rsquo;t saved any addresses yet.
          </p>
        ) : null}
        <ul className="address-grid">
          {addresses.nodes.map((address) => (
            <AddressCard
              address={address}
              defaultAddress={defaultAddress}
              isDefault={defaultAddress?.id === address.id}
              key={address.id}
            />
          ))}
          <li className="address-card address-card--new">
            <details className="address-card__details">
              <summary className="address-card__summary">
                <span className="address-card__plus" aria-hidden="true">
                  <PlusIcon size={18} />
                </span>
                <span>Add a new address</span>
              </summary>
              <div className="address-card__panel">
                <NewAddressForm key={addresses.nodes.length} />
              </div>
            </details>
          </li>
        </ul>
      </section>
    </div>
  );
}

function AddressCard({
  address,
  defaultAddress,
  isDefault,
}: {
  address: AddressFragment;
  defaultAddress: CustomerFragment['defaultAddress'];
  isDefault: boolean;
}) {
  const name = [address.firstName, address.lastName].filter(Boolean).join(' ');
  const lines = [
    ...(address.formatted ?? []),
    ...(address.phoneNumber ? [address.phoneNumber] : []),
  ];

  return (
    <li className={`address-card ${isDefault ? 'is-default' : ''}`.trim()}>
      <div className="address-card__body">
        <div className="address-card__top">
          <p className="address-card__name">{name || 'Saved address'}</p>
          {isDefault ? (
            <Badge tone="primary" className="badge--soft">
              Default
            </Badge>
          ) : null}
        </div>
        <address className="account-address">{lines.join('\n')}</address>
      </div>
      <details className="address-card__details">
        <summary className="btn btn--outline btn--sm address-card__edit">
          Edit address
        </summary>
        <div className="address-card__panel">
          <AddressForm
            addressId={address.id}
            address={address}
            defaultAddress={defaultAddress}
          >
            {({stateForMethod}) => (
              <div className="account-form__actions">
                <Button
                  formMethod="PUT"
                  loading={stateForMethod('PUT') !== 'idle'}
                  size="sm"
                  type="submit"
                >
                  Save
                </Button>
                <Button
                  className="btn--danger"
                  formMethod="DELETE"
                  loading={stateForMethod('DELETE') !== 'idle'}
                  size="sm"
                  type="submit"
                  variant="ghost"
                >
                  Delete
                </Button>
              </div>
            )}
          </AddressForm>
        </div>
      </details>
    </li>
  );
}

function NewAddressForm() {
  const newAddress = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    territoryCode: '',
    firstName: '',
    id: 'new',
    lastName: '',
    phoneNumber: '',
    zoneCode: '',
    zip: '',
  } as CustomerAddressInput;

  return (
    <AddressForm
      addressId={'NEW_ADDRESS_ID'}
      address={newAddress}
      defaultAddress={null}
    >
      {({stateForMethod}) => (
        <div className="account-form__actions">
          <Button
            formMethod="POST"
            loading={stateForMethod('POST') !== 'idle'}
            size="sm"
            type="submit"
          >
            Save address
          </Button>
        </div>
      )}
    </AddressForm>
  );
}

export function AddressForm({
  addressId,
  address,
  defaultAddress,
  children,
}: {
  addressId: AddressFragment['id'];
  address: CustomerAddressInput;
  defaultAddress: CustomerFragment['defaultAddress'];
  children: (props: {
    stateForMethod: (method: 'PUT' | 'POST' | 'DELETE') => Fetcher['state'];
  }) => React.ReactNode;
}) {
  const {state, formMethod} = useNavigation();
  const action = useActionData<ActionResponse>();
  const error = action?.error?.[addressId];
  const isDefaultAddress = defaultAddress?.id === addressId;
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  return (
    <Form id={addressId} className="account-form">
      <fieldset className="account-form__fieldset">
        <input type="hidden" name="addressId" defaultValue={addressId} />
        <div className="account-form__grid">
          <div className="field">
            <label htmlFor={fieldId('firstName')}>First name*</label>
            <input
              autoComplete="given-name"
              defaultValue={address?.firstName ?? ''}
              id={fieldId('firstName')}
              name="firstName"
              placeholder="First name"
              required
              type="text"
            />
          </div>
          <div className="field">
            <label htmlFor={fieldId('lastName')}>Last name*</label>
            <input
              autoComplete="family-name"
              defaultValue={address?.lastName ?? ''}
              id={fieldId('lastName')}
              name="lastName"
              placeholder="Last name"
              required
              type="text"
            />
          </div>
          <div className="field field--full">
            <label htmlFor={fieldId('company')}>Company</label>
            <input
              autoComplete="organization"
              defaultValue={address?.company ?? ''}
              id={fieldId('company')}
              name="company"
              placeholder="Company"
              type="text"
            />
          </div>
          <div className="field field--full">
            <label htmlFor={fieldId('address1')}>Address line 1*</label>
            <input
              autoComplete="address-line1"
              defaultValue={address?.address1 ?? ''}
              id={fieldId('address1')}
              name="address1"
              placeholder="Street address"
              required
              type="text"
            />
          </div>
          <div className="field field--full">
            <label htmlFor={fieldId('address2')}>Address line 2</label>
            <input
              autoComplete="address-line2"
              defaultValue={address?.address2 ?? ''}
              id={fieldId('address2')}
              name="address2"
              placeholder="Apartment, suite, unit"
              type="text"
            />
          </div>
          <div className="field">
            <label htmlFor={fieldId('city')}>City*</label>
            <input
              autoComplete="address-level2"
              defaultValue={address?.city ?? ''}
              id={fieldId('city')}
              name="city"
              placeholder="City"
              required
              type="text"
            />
          </div>
          <div className="field">
            <label htmlFor={fieldId('zoneCode')}>State / Province*</label>
            <input
              autoComplete="address-level1"
              defaultValue={address?.zoneCode ?? ''}
              id={fieldId('zoneCode')}
              name="zoneCode"
              placeholder="e.g. CA"
              required
              type="text"
            />
          </div>
          <div className="field">
            <label htmlFor={fieldId('zip')}>ZIP / Postal code*</label>
            <input
              autoComplete="postal-code"
              defaultValue={address?.zip ?? ''}
              id={fieldId('zip')}
              name="zip"
              placeholder="ZIP / Postal code"
              required
              type="text"
            />
          </div>
          <div className="field">
            <label htmlFor={fieldId('territoryCode')}>Country code*</label>
            <input
              autoComplete="country"
              defaultValue={address?.territoryCode ?? ''}
              id={fieldId('territoryCode')}
              maxLength={2}
              name="territoryCode"
              placeholder="e.g. US"
              required
              type="text"
            />
            <span className="field__hint">Two-letter country code</span>
          </div>
          <div className="field field--full">
            <label htmlFor={fieldId('phoneNumber')}>Phone</label>
            <input
              autoComplete="tel"
              defaultValue={address?.phoneNumber ?? ''}
              id={fieldId('phoneNumber')}
              name="phoneNumber"
              pattern="^\+?[1-9]\d{3,14}$"
              placeholder="+16135551111"
              type="tel"
            />
          </div>
        </div>

        <label className="checkbox" htmlFor={fieldId('defaultAddress')}>
          <input
            defaultChecked={isDefaultAddress}
            id={fieldId('defaultAddress')}
            name="defaultAddress"
            type="checkbox"
          />
          <span>Set as default address</span>
        </label>

        <div className="account-form__messages" aria-live="polite">
          {error ? (
            <p className="form-message form-message--error">{error}</p>
          ) : null}
        </div>

        {children({
          stateForMethod: (method) => (formMethod === method ? state : 'idle'),
        })}
      </fieldset>
    </Form>
  );
}
