import {createElement, type ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ORIGIN, renderRoute} from './__tests__/route-test-utils';
import {
  Pagination,
  getPaginationVariables,
  type Connection,
  type PageInfo,
  type PaginationRenderProps,
} from './pagination';

// Records the props each pagination link hands to React Router's <Link>:
// `replace`, `preventScrollReset` and `state` never reach the markup. The real
// <Link> still renders, so hrefs come from React Router's own resolution.
const linkProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  const react = await import('react');
  return {
    ...actual,
    Link: react.forwardRef<HTMLAnchorElement, Record<string, unknown>>(
      (props, ref) => {
        linkProps.push(props);
        return react.createElement(actual.Link as never, {...props, ref});
      },
    ),
  };
});

beforeEach(() => {
  linkProps.length = 0;
});

type Item = {id: string; title: string};

const ALPHA: Item = {id: 'a', title: 'Alpha'};
const BETA: Item = {id: 'b', title: 'Beta'};
const PAGE_INFO: PageInfo = {
  hasNextPage: true,
  hasPreviousPage: true,
  startCursor: 'START',
  endCursor: 'END',
};

function connectionOf(pageInfo: Partial<PageInfo> = {}): Connection<Item> {
  return {nodes: [ALPHA, BETA], pageInfo: {...PAGE_INFO, ...pageInfo}};
}

function renderList({
  nodes,
  PreviousLink,
  NextLink,
}: PaginationRenderProps<Item>) {
  return (
    <>
      <PreviousLink className="previous">Load previous</PreviousLink>
      <ul>
        {nodes.map((node) => (
          <li key={node.id}>{node.title}</li>
        ))}
      </ul>
      <NextLink className="next">Load more</NextLink>
    </>
  );
}

function renderPagination({
  connection = connectionOf(),
  url = `${ORIGIN}/collections/all`,
  namespace,
  children = renderList,
}: {
  connection?: Connection<Item>;
  url?: string;
  namespace?: string;
  children?: (props: PaginationRenderProps<Item>) => ReactNode;
} = {}) {
  return renderRoute({
    path: new URL(url).pathname,
    url,
    loaderData: null,
    Component: () => (
      <Pagination connection={connection} namespace={namespace}>
        {children}
      </Pagination>
    ),
  });
}

/** The (decoded) href of the anchor with the given class. */
function hrefOf(html: string, className: string) {
  const anchor = new RegExp(`<a[^>]*class="${className}"[^>]*>`).exec(html);
  const href = anchor && /href="([^"]*)"/.exec(anchor[0]);
  return href ? href[1].replace(/&amp;/g, '&') : undefined;
}

/** What the render prop received, without rendering anything. */
async function capturePaginationProps(
  options: Parameters<typeof renderPagination>[0] = {},
) {
  const seen: Array<PaginationRenderProps<Item>> = [];
  await renderPagination({
    ...options,
    children: (props) => {
      seen.push(props);
      return null;
    },
  });
  return seen[0];
}

describe('<Pagination> nodes', () => {
  it('renders the nodes of a nodes connection in order', async () => {
    const html = await renderPagination();

    expect(html).toContain('<ul><li>Alpha</li><li>Beta</li></ul>');
  });

  it('renders the nodes of an edges connection in order', async () => {
    const connection: Connection<Item> = {
      edges: [{node: ALPHA}, {node: BETA}],
      pageInfo: PAGE_INFO,
    };

    const html = await renderPagination({connection});

    expect(html).toContain('<ul><li>Alpha</li><li>Beta</li></ul>');
  });

  it('renders an empty list for an empty connection', async () => {
    const connection: Connection<Item> = {
      nodes: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
    };

    const html = await renderPagination({connection});

    expect(html).toContain('<ul></ul>');
    expect(html).not.toContain('<a ');
  });
});

describe('<Pagination> links', () => {
  it('links to the next page with the end cursor', async () => {
    const html = await renderPagination();

    expect(hrefOf(html, 'next')).toBe(
      '/collections/all?direction=next&cursor=END',
    );
  });

  it('links to the previous page with the start cursor', async () => {
    const html = await renderPagination();

    expect(hrefOf(html, 'previous')).toBe(
      '/collections/all?direction=previous&cursor=START',
    );
  });

  it('keeps the other parameters and adds direction before cursor', async () => {
    const html = await renderPagination({
      url: `${ORIGIN}/search?q=a`,
      connection: connectionOf({hasPreviousPage: false}),
    });

    expect(hrefOf(html, 'next')).toBe('/search?q=a&direction=next&cursor=END');
  });

  it('moves the cursor of the page being shown to the next one', async () => {
    const html = await renderPagination({
      url: `${ORIGIN}/collections/all?direction=next&cursor=OLD`,
    });

    expect(hrefOf(html, 'next')).toBe(
      '/collections/all?direction=next&cursor=END',
    );
    expect(hrefOf(html, 'previous')).toBe(
      '/collections/all?direction=previous&cursor=START',
    );
  });

  it('prefixes the parameters with the namespace', async () => {
    const html = await renderPagination({namespace: 'reviews'});

    expect(hrefOf(html, 'next')).toBe(
      '/collections/all?reviews_direction=next&reviews_cursor=END',
    );
    expect(hrefOf(html, 'previous')).toBe(
      '/collections/all?reviews_direction=previous&reviews_cursor=START',
    );
  });

  it('shows no "Load more" link on the last page', async () => {
    const html = await renderPagination({
      connection: connectionOf({hasNextPage: false}),
    });

    expect(hrefOf(html, 'next')).toBeUndefined();
    expect(hrefOf(html, 'previous')).toBeDefined();
  });

  it('shows no "Load previous" link on the first page', async () => {
    const html = await renderPagination({
      connection: connectionOf({hasPreviousPage: false}),
    });

    expect(hrefOf(html, 'previous')).toBeUndefined();
    expect(hrefOf(html, 'next')).toBeDefined();
  });

  it('passes the other props through to the anchor', async () => {
    const html = await renderPagination({
      children: ({NextLink}) => (
        <NextLink className="next" aria-label="More products">
          Load more
        </NextLink>
      ),
    });

    expect(html).toMatch(
      /<a[^>]*aria-label="More products"[^>]*>Load more<\/a>/,
    );
  });

  it('replaces the history entry and keeps the scroll position', async () => {
    await renderPagination();

    expect(linkProps).toHaveLength(2);
    for (const props of linkProps) {
      expect(props).toMatchObject({replace: true, preventScrollReset: true});
    }
  });

  it('lets a caller choose to reset the scroll position', async () => {
    await renderPagination({
      children: ({NextLink}) => (
        <NextLink preventScrollReset={false}>Load more</NextLink>
      ),
    });

    expect(linkProps[0]).toMatchObject({preventScrollReset: false});
  });

  it('carries the nodes and page info shown so far, so the next page appends to them', async () => {
    const seen: Array<PaginationRenderProps<Item>> = [];

    await renderPagination({
      children: (props) => {
        seen.push(props);
        return renderList(props);
      },
    });

    const expectedState = {
      pagination: {'': {nodes: [ALPHA, BETA], pageInfo: PAGE_INFO}},
    };
    expect(seen[0].state).toEqual(expectedState);
    expect(linkProps).toHaveLength(2);
    for (const props of linkProps) {
      expect(props.state).toBe(seen[0].state);
    }
  });

  it('keeps its own target even when handed another one', async () => {
    await renderPagination({
      children: ({NextLink}) =>
        createElement(NextLink, {to: '/elsewhere', replace: false} as never),
    });

    expect(linkProps[0]).toMatchObject({
      to: '?direction=next&cursor=END',
      replace: true,
    });
  });
});

describe('<Pagination> render props', () => {
  it('hands the flags, URLs and loading state to the render prop', async () => {
    const received = await capturePaginationProps();

    expect(received).toMatchObject({
      nodes: [ALPHA, BETA],
      isLoading: false,
      hasNextPage: true,
      hasPreviousPage: true,
      nextPageUrl: '?direction=next&cursor=END',
      previousPageUrl: '?direction=previous&cursor=START',
    });
  });

  it('reports the flags of the connection', async () => {
    const received = await capturePaginationProps({
      connection: connectionOf({hasNextPage: false, hasPreviousPage: false}),
    });

    expect(received).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});

describe('<Pagination> without the page info its query must select', () => {
  it('names pageInfo when the query leaves it out entirely', async () => {
    const connection = {nodes: [ALPHA], pageInfo: undefined} as never;

    await expect(renderPagination({connection})).rejects.toThrow(
      'The Pagination component requires `pageInfo` to be a part of your query.',
    );
  });

  it.each(['startCursor', 'endCursor', 'hasNextPage', 'hasPreviousPage'])(
    'names pageInfo.%s when the query leaves it out',
    async (field) => {
      const connection = connectionOf({[field]: undefined});

      await expect(renderPagination({connection})).rejects.toThrow(
        `The Pagination component requires \`pageInfo.${field}\` to be a part of your query.`,
      );
    },
  );

  it('accepts null cursors', async () => {
    const connection = connectionOf({startCursor: null, endCursor: null});

    await expect(renderPagination({connection})).resolves.toContain('<ul>');
  });
});

describe('getPaginationVariables', () => {
  it('is available from the pagination module for the loaders', () => {
    const request = new Request(`${ORIGIN}/?direction=previous&cursor=c`);

    expect(getPaginationVariables(request, {pageBy: 4})).toEqual({
      last: 4,
      startCursor: 'c',
    });
  });
});
