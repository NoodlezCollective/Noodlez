import {isRouteErrorResponse, useRouteError} from 'react-router';
import type {Route} from './+types/$';
import {ErrorView} from '~/components/ErrorView';

export const meta: Route.MetaFunction = () => {
  return [
    {title: 'Page not found | Mellow'},
    {name: 'robots', content: 'noindex'},
  ];
};

export async function loader({request}: Route.LoaderArgs) {
  throw new Response(`${new URL(request.url).pathname} not found`, {
    status: 404,
  });
}

export default function CatchAllPage() {
  return null;
}

/**
 * Handles the 404 thrown by the loader with the same designed error view the
 * root ErrorBoundary uses. Catching it here (instead of letting it bubble to
 * the root) lets this route's `meta` set the "Page not found" title.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? String(error.data ?? '')
    : error instanceof Error
      ? error.message
      : undefined;

  return <ErrorView status={status} message={message} />;
}
