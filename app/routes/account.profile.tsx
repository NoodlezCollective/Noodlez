import type {CustomerFragment} from 'customer-accountapi.generated';
import type {CustomerUpdateInput} from '@shopify/hydrogen-react/customer-account-api-types';
import {CUSTOMER_UPDATE_MUTATION} from '~/graphql/customer-account/CustomerUpdateMutation';
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import {useId} from 'react';
import type {Route} from './+types/account.profile';
import {Button} from '~/components/ui/Button';

export type ActionResponse = {
  error: string | null;
  customer: CustomerFragment | null;
};

export const meta: Route.MetaFunction = () => {
  return [{title: 'Profile | Mellow'}];
};

export async function loader({context}: Route.LoaderArgs) {
  await context.customerAccount.handleAuthStatus();

  return {};
}

export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;

  if (request.method !== 'PUT') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  const form = await request.formData();

  try {
    const customer: CustomerUpdateInput = {};
    const validInputKeys = ['firstName', 'lastName'] as const;
    for (const [key, value] of form.entries()) {
      if (!(validInputKeys as readonly string[]).includes(key)) {
        continue;
      }
      if (typeof value === 'string' && value.length) {
        customer[key as (typeof validInputKeys)[number]] = value;
      }
    }

    // update customer and possibly password
    const {data, errors} = await customerAccount.mutate(
      CUSTOMER_UPDATE_MUTATION,
      {
        variables: {
          customer,
          language: customerAccount.i18n.language,
        },
      },
    );

    if (errors?.length) {
      throw new Error(errors[0].message);
    }

    if (!data?.customerUpdate?.customer) {
      throw new Error('Customer profile update failed.');
    }

    return {
      error: null,
      customer: data?.customerUpdate?.customer,
    };
  } catch (error: unknown) {
    // `customerAccount.mutate` throws a redirect `Response` when the session
    // has expired; it must reach React Router instead of becoming a 400.
    if (error instanceof Response) throw error;

    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Customer profile update failed.',
        customer: null,
      },
      {
        status: 400,
      },
    );
  }
}

export default function AccountProfile() {
  const account = useOutletContext<{customer: CustomerFragment}>();
  const {state} = useNavigation();
  const action = useActionData<ActionResponse>();
  const customer = action?.customer ?? account?.customer;
  const firstNameId = useId();
  const lastNameId = useId();
  const saving = state !== 'idle';
  const saved = Boolean(action && !action.error && action.customer);

  return (
    <div className="account-section account-profile">
      <header className="account-section__header">
        <h2>Profile</h2>
        <p className="text-muted">
          The name we use on your orders, receipts and deliveries.
        </p>
      </header>

      <Form method="PUT" className="account-card account-form">
        <fieldset className="account-form__fieldset">
          <legend className="account-card__subtitle">
            Personal information
          </legend>
          <div className="account-form__grid">
            <div className="field">
              <label htmlFor={firstNameId}>First name</label>
              <input
                id={firstNameId}
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="First name"
                defaultValue={customer.firstName ?? ''}
                minLength={2}
              />
            </div>
            <div className="field">
              <label htmlFor={lastNameId}>Last name</label>
              <input
                id={lastNameId}
                name="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Last name"
                defaultValue={customer.lastName ?? ''}
                minLength={2}
              />
            </div>
          </div>
        </fieldset>

        <div className="account-form__footer">
          <div className="account-form__messages" aria-live="polite">
            {action?.error ? (
              <p className="form-message form-message--error">{action.error}</p>
            ) : null}
            {saved ? (
              <p className="form-message form-message--success">
                Your profile has been updated.
              </p>
            ) : null}
          </div>
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </Form>
    </div>
  );
}
