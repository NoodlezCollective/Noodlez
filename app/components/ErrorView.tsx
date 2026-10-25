import {isRouteErrorResponse, useRouteError} from 'react-router';
import {Button} from '~/components/ui/Button';

/**
 * Designed error page used by the root ErrorBoundary and the route-level
 * boundaries (see RouteErrorBoundary).
 */
export function ErrorView({
  status,
  message,
}: {
  status: number;
  message?: string;
}) {
  const notFound = status === 404;
  return (
    <section className="route-error container">
      <p className="route-error__code" aria-hidden="true">
        {status}
      </p>
      <h1>{notFound ? 'We couldn’t find that page' : 'Something went wrong'}</h1>
      <p className="text-muted" style={{maxWidth: 480}}>
        {notFound
          ? 'The page may have moved or the link might be out of date. Let’s get you back to better sleep.'
          : 'An unexpected error occurred while loading this page. Please try again in a moment.'}
      </p>
      <div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center'}}>
        <Button to="/">Back to home</Button>
        <Button to="/collections/all" variant="outline">
          Shop all
        </Button>
      </div>
      {!notFound && message && import.meta.env.DEV ? <pre>{message}</pre> : null}
    </section>
  );
}

/**
 * ErrorBoundary shared by the routes that keep thrown responses (404, 502)
 * inside the route, so that the route's own `meta` (not-found title,
 * `noindex`) still applies. A route module opts in with:
 *
 *   export {RouteErrorBoundary as ErrorBoundary} from '~/components/ErrorView';
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? String(error.data ?? '')
    : error instanceof Error
      ? error.message
      : undefined;
  return <ErrorView status={status} message={message} />;
}
