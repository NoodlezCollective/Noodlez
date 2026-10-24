import {
  useFetcher,
  useNavigate,
  type FormProps,
  type Fetcher,
} from 'react-router';
import React, {useRef, useEffect} from 'react';
import type {PredictiveSearchResponse} from '~/lib/search';
import {useAside} from './Aside';

type SearchFormPredictiveChildren = (args: {
  fetchResults: (event: React.ChangeEvent<HTMLInputElement>) => void;
  goToSearch: () => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  fetcher: Fetcher<PredictiveSearchResponse>;
}) => React.ReactNode;

type SearchFormPredictiveProps = Omit<FormProps, 'children'> & {
  children: SearchFormPredictiveChildren | null;
};

export const SEARCH_ENDPOINT = '/search';

/**
 *  Search form component that sends search requests to the `/search` route
 **/
export function SearchFormPredictive({
  children,
  className = 'predictive-search-form',
  ...props
}: SearchFormPredictiveProps) {
  const fetcher = useFetcher<PredictiveSearchResponse>({key: 'search'});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const aside = useAside();

  /** Navigate to the search page with the current input value */
  function goToSearch() {
    const term = inputRef?.current?.value.trim();
    void navigate(
      SEARCH_ENDPOINT + (term ? `?q=${encodeURIComponent(term)}` : ''),
    );
    aside.close();
  }

  /**
   * Enter (or the mobile keyboard's "Search" key) opens the full results for
   * the typed term. An empty input does nothing.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (inputRef?.current?.value.trim()) goToSearch();
  }

  /** Fetch search results based on the input value */
  function fetchResults(event: React.ChangeEvent<HTMLInputElement>) {
    void fetcher.submit(
      {q: event.target.value || '', limit: 5, predictive: true},
      {method: 'GET', action: SEARCH_ENDPOINT},
    );
  }

  // ensure the passed input has a type of search, because SearchResults
  // will select the element based on the input
  useEffect(() => {
    inputRef?.current?.setAttribute('type', 'search');
  }, []);

  if (typeof children !== 'function') {
    return null;
  }

  return (
    <fetcher.Form
      action={SEARCH_ENDPOINT}
      {...props}
      className={className}
      onSubmit={handleSubmit}
    >
      {children({inputRef, fetcher, fetchResults, goToSearch})}
    </fetcher.Form>
  );
}
