import {data, redirect} from 'react-router';
import type {Route} from './+types/newsletter';
import {
  getNewsletterHttpStatus,
  subscribeToNewsletter,
  type NewsletterResult,
} from '~/lib/newsletter.server';

export type NewsletterActionData = NewsletterResult;

/** Same body shape as ever (`NewsletterForm` reads it); only the status varies. */
function respond(result: NewsletterActionData) {
  return data<NewsletterActionData>(result, {
    status: getNewsletterHttpStatus(result),
  });
}

export async function loader() {
  return redirect('/');
}

export async function action({request, context}: Route.ActionArgs) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    // Not a form submission (JSON, plain text, a truncated multipart body …):
    // a client error, not a server crash.
    return respond({
      ok: false,
      status: 'invalid',
      message: 'We could not read that request. Please try again.',
    });
  }

  const email = String(formData.get('email') ?? '');
  const source = String(formData.get('source') ?? 'storefront');
  const honeypot = String(formData.get('website') ?? '');

  // Bots fill the hidden field: acknowledge silently without doing anything.
  if (honeypot) {
    return respond({ok: true, status: 'subscribed', message: 'Thanks!'});
  }

  return respond(
    await subscribeToNewsletter({email, source, env: context.env}),
  );
}

export default function Newsletter() {
  return null;
}
