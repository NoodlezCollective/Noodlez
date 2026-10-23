import {data, redirect} from 'react-router';
import type {Route} from './+types/newsletter';
import {subscribeToNewsletter, type NewsletterResult} from '~/lib/newsletter.server';

export type NewsletterActionData = NewsletterResult;

export async function loader() {
  return redirect('/');
}

export async function action({request, context}: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '');
  const source = String(formData.get('source') ?? 'storefront');
  const honeypot = String(formData.get('website') ?? '');

  // Bots fill the hidden field: acknowledge silently without doing anything.
  if (honeypot) {
    return data<NewsletterActionData>({
      ok: true,
      status: 'subscribed',
      message: 'Thanks!',
    });
  }

  const result = await subscribeToNewsletter({email, source, env: context.env});
  return data<NewsletterActionData>(result, {status: result.ok ? 200 : 400});
}

export default function Newsletter() {
  return null;
}
