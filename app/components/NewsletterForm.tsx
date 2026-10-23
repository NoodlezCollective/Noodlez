import {useEffect, useId, useRef} from 'react';
import {useFetcher} from 'react-router';
import {Button} from '~/components/ui/Button';
import type {NewsletterActionData} from '~/routes/newsletter';

export function NewsletterForm({
  id,
  source,
  placeholder = 'Enter your email',
  ctaLabel = 'Sign Up',
}: {
  id: string;
  source: string;
  placeholder?: string;
  ctaLabel?: string;
}) {
  const fetcher = useFetcher<NewsletterActionData>({key: `newsletter-${id}`});
  const formRef = useRef<HTMLFormElement>(null);
  const inputId = useId();
  const messageId = useId();
  const data = fetcher.data;
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (data?.ok) formRef.current?.reset();
  }, [data]);

  return (
    <fetcher.Form
      ref={formRef}
      method="post"
      action="/newsletter"
      className="newsletter-form"
    >
      <label htmlFor={inputId} className="sr-only">
        Email address
      </label>
      <div className="newsletter-form__row">
        <input
          id={inputId}
          type="email"
          name="email"
          required
          placeholder={placeholder}
          autoComplete="email"
          aria-describedby={data ? messageId : undefined}
          aria-invalid={data?.ok === false ? true : undefined}
        />
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="sr-only"
          aria-hidden="true"
          defaultValue=""
        />
        <input type="hidden" name="source" value={source} />
        <Button type="submit" loading={busy}>
          {ctaLabel}
        </Button>
      </div>
      {data ? (
        <p
          id={messageId}
          className={`form-message ${data.ok ? 'form-message--success' : 'form-message--error'}`}
          role="status"
        >
          {data.message}
        </p>
      ) : null}
    </fetcher.Form>
  );
}
