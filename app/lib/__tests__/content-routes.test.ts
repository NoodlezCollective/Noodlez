import {afterEach, describe, expect, it, vi} from 'vitest';
import Article, {
  loader as articleLoader,
  meta as articleMeta,
} from '../../routes/blogs.$blogHandle.$articleHandle';
import Blog, {
  loader as blogLoader,
  meta as blogMeta,
} from '../../routes/blogs.$blogHandle._index';
import {
  loader as blogsLoader,
  meta as blogsMeta,
} from '../../routes/blogs._index';
import {
  loader as pageLoader,
  meta as pageMeta,
} from '../../routes/pages.$handle';
import {
  loader as policiesLoader,
  meta as policiesMeta,
} from '../../routes/policies._index';
import {
  ORIGIN,
  callRoute,
  createFakeStorefront,
  expectValidStorefrontDocument,
  renderRoute,
  thrownResponse,
} from './route-test-utils';

afterEach(() => {
  vi.unstubAllEnvs();
});

const NOT_FOUND_BASE = [{name: 'robots', content: 'noindex'}];

/** The `meta` array of a route as plain data. */
function tags(
  meta: (args: never) => unknown,
  data: unknown,
): Array<Record<string, string>> {
  return callRoute(meta as never, {data}) as Array<Record<string, string>>;
}

const PAGE_INFO = {
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: null,
  endCursor: null,
};

describe('pages/:handle', () => {
  const page = {
    id: 'gid://shopify/Page/1',
    handle: 'faq',
    title: 'FAQ',
    body: '<p>Answers</p>',
    bodySummary: 'Answers to the questions we hear most.',
    seo: {title: null, description: null},
  };

  function load(data: unknown, handle = 'faq') {
    const storefront = createFakeStorefront(data);
    const promise = callRoute(pageLoader, {
      request: new Request(`${ORIGIN}/pages/${handle}`),
      context: {storefront},
      params: {handle},
    });
    return {promise, storefront};
  }

  it('loads the page with the request origin and a valid query', async () => {
    const {promise, storefront} = load({page});

    expect(await promise).toEqual({page, origin: ORIGIN});
    expectValidStorefrontDocument(storefront.query.mock.calls[0][0]);
  });

  it('answers 404 for a missing page', async () => {
    const {promise} = load({page: null}, 'nope');
    expect((await thrownResponse(promise)).status).toBe(404);
  });

  it('has Open Graph tags, an absolute canonical and the body summary as description', () => {
    expect(tags(pageMeta, {page, origin: ORIGIN})).toEqual([
      {title: 'FAQ | Mellow'},
      {name: 'description', content: 'Answers to the questions we hear most.'},
      {property: 'og:title', content: 'FAQ | Mellow'},
      {
        property: 'og:description',
        content: 'Answers to the questions we hear most.',
      },
      {property: 'og:type', content: 'website'},
      {tagName: 'link', rel: 'canonical', href: `${ORIGIN}/pages/faq`},
    ]);
  });

  it('prefers the SEO title and description over the page title and summary', () => {
    const seo = {title: 'Help centre', description: 'Find help fast.'};
    const result = tags(pageMeta, {page: {...page, seo}, origin: ORIGIN});
    expect(result).toContainEqual({title: 'Help centre | Mellow'});
    expect(result).toContainEqual({
      name: 'description',
      content: 'Find help fast.',
    });
    expect(result).toContainEqual({
      property: 'og:description',
      content: 'Find help fast.',
    });
  });

  it('omits the descriptions when there is nothing to say', () => {
    const result = tags(pageMeta, {
      page: {...page, bodySummary: ''},
      origin: ORIGIN,
    });
    expect(result.some((tag) => tag.name === 'description')).toBe(false);
    expect(result.some((tag) => tag.property === 'og:description')).toBe(false);
  });

  it('is a noindex "not found" page when the loader threw', () => {
    expect(tags(pageMeta, undefined)).toEqual([
      {title: 'Page not found | Mellow'},
      ...NOT_FOUND_BASE,
    ]);
  });
});

describe('policies', () => {
  const policies = {
    shop: {
      privacyPolicy: {
        id: 'p1',
        title: 'Privacy policy',
        handle: 'privacy-policy',
      },
      shippingPolicy: null,
      termsOfService: null,
      refundPolicy: null,
      subscriptionPolicy: {
        id: null,
        title: 'Subscription policy',
        handle: 'subscription-policy',
      },
    },
  };

  function load(data: unknown) {
    const storefront = createFakeStorefront(data);
    const promise = callRoute(policiesLoader, {
      request: new Request(`${ORIGIN}/policies`),
      context: {storefront},
    });
    return {promise, storefront};
  }

  it('lists every policy in order, with the subscription policy (id may be null) after refunds', async () => {
    const {promise, storefront} = load(policies);

    const result = (await promise) as {
      policies: Array<{handle: string; title: string}>;
      origin: string;
    };

    expect(result.policies.map((policy) => policy.handle)).toEqual([
      'privacy-policy',
      'shipping-policy',
      'terms-of-service',
      'refund-policy',
      'subscription-policy',
      'contact-information',
      'legal-notice',
    ]);
    // Shopify's title wins where the store has published the policy.
    expect(result.policies[0].title).toBe('Privacy policy');
    expect(result.origin).toBe(ORIGIN);
    expectValidStorefrontDocument(storefront.query.mock.calls[0][0]);
  });

  it('falls back to the storefront documents when the store has no policies', async () => {
    const {promise} = load({shop: {privacyPolicy: null}});
    const result = (await promise) as {policies: Array<{handle: string}>};
    expect(result.policies.map((policy) => policy.handle)).toEqual([
      'privacy-policy',
      'shipping-policy',
      'terms-of-service',
      'refund-policy',
      'contact-information',
      'legal-notice',
    ]);
  });

  it('has an absolute canonical and Open Graph tags', () => {
    const result = tags(policiesMeta, {policies: [], origin: ORIGIN});
    expect(result).toContainEqual({
      tagName: 'link',
      rel: 'canonical',
      href: `${ORIGIN}/policies`,
    });
    expect(result).toContainEqual({
      property: 'og:title',
      content: 'Policies | Mellow',
    });
    expect(result).toContainEqual({property: 'og:type', content: 'website'});
  });

  it('is a noindex "not found" page when the loader threw', () => {
    expect(tags(policiesMeta, undefined)).toEqual([
      {title: 'Policies not found | Mellow'},
      ...NOT_FOUND_BASE,
    ]);
  });
});

describe('blogs index', () => {
  it('returns the blogs and the request origin for the canonical link', async () => {
    const blogs = {nodes: [], pageInfo: PAGE_INFO};
    const storefront = createFakeStorefront({blogs});

    const result = await callRoute(blogsLoader, {
      request: new Request(`${ORIGIN}/blogs`),
      context: {storefront},
    });

    expect(result).toEqual({blogs, origin: ORIGIN});
    expectValidStorefrontDocument(storefront.query.mock.calls[0][0]);
  });

  it('has an absolute canonical and Open Graph tags', () => {
    const result = tags(blogsMeta, {blogs: {nodes: []}, origin: ORIGIN});
    expect(result).toContainEqual({
      tagName: 'link',
      rel: 'canonical',
      href: `${ORIGIN}/blogs`,
    });
    expect(result).toContainEqual({
      property: 'og:title',
      content: 'Journal | Mellow',
    });
    expect(result).toContainEqual({property: 'og:type', content: 'website'});
    expect(
      result.some((tag) => tag.rel === 'canonical' && tag.href === '/blogs'),
    ).toBe(false);
  });

  it('keeps a failed load out of the index', () => {
    expect(tags(blogsMeta, undefined)).toEqual([
      {title: 'Journal | Mellow'},
      ...NOT_FOUND_BASE,
    ]);
  });
});

describe('blogs/:blogHandle', () => {
  const article = (overrides: Record<string, unknown> = {}) => ({
    id: 'gid://shopify/Article/1',
    handle: 'sleep-better',
    title: 'How to sleep better',
    publishedAt: '2026-09-12T02:30:00Z',
    author: {name: 'Ada'},
    image: null,
    excerpt: 'A short editor-written teaser.',
    content: 'The start of the article body.',
    blog: {handle: 'journal'},
    ...overrides,
  });
  const blog = (articles: unknown[] = [article()]) => ({
    title: 'Sleep Journal',
    handle: 'journal',
    seo: {title: null, description: 'Sleep science and stories.'},
    articles: {nodes: articles, pageInfo: PAGE_INFO},
  });

  function load(data: unknown, handle = 'journal') {
    const storefront = createFakeStorefront(data);
    const promise = callRoute(blogLoader, {
      request: new Request(`${ORIGIN}/blogs/${handle}`),
      context: {storefront},
      params: {blogHandle: handle},
    });
    return {promise, storefront};
  }

  it('loads the blog with the request origin and a valid query', async () => {
    const {promise, storefront} = load({blog: blog()});

    expect(await promise).toEqual({blog: blog(), origin: ORIGIN});
    const document = storefront.query.mock.calls[0][0] as string;
    expectValidStorefrontDocument(document);
    // The list no longer downloads whole articles just to cut an excerpt.
    expect(document).not.toContain('contentHtml');
    expect(document).toContain('excerpt(truncateAt: 160)');
  });

  it('answers 404 for a missing blog', async () => {
    const {promise} = load({blog: null}, 'nope');
    expect((await thrownResponse(promise)).status).toBe(404);
  });

  it('has Open Graph tags and an absolute canonical', () => {
    expect(tags(blogMeta, {blog: blog(), origin: ORIGIN})).toEqual([
      {title: 'Sleep Journal | Mellow'},
      {name: 'description', content: 'Sleep science and stories.'},
      {property: 'og:title', content: 'Sleep Journal | Mellow'},
      {property: 'og:description', content: 'Sleep science and stories.'},
      {property: 'og:type', content: 'website'},
      {tagName: 'link', rel: 'canonical', href: `${ORIGIN}/blogs/journal`},
    ]);
  });

  it('is a noindex "not found" page when the loader threw', () => {
    expect(tags(blogMeta, undefined)).toEqual([
      {title: 'Blog not found | Mellow'},
      ...NOT_FOUND_BASE,
    ]);
  });

  describe('article cards', () => {
    function render(articles: unknown[]) {
      return renderRoute({
        path: '/blogs/:blogHandle',
        url: `${ORIGIN}/blogs/journal`,
        Component: Blog as never,
        loaderData: {blog: blog(articles), origin: ORIGIN},
      });
    }

    it('shows the editor excerpt, falling back to the start of the article', async () => {
      const html = await render([
        article(),
        article({
          id: 'a2',
          handle: 'two',
          excerpt: null,
          content: 'Tom & Jerry fall asleep.',
        }),
      ]);

      expect(html).toContain('A short editor-written teaser.');
      // Plain text from the API is escaped once by React, never double-escaped.
      expect(html).toContain('Tom &amp; Jerry fall asleep.');
      expect(html).not.toContain('&amp;amp;');
    });

    it('formats the publish date in UTC whatever the time zone of the renderer', async () => {
      // 02:30 UTC on the 12th is still the 11th in Los Angeles.
      vi.stubEnv('TZ', 'America/Los_Angeles');
      expect(
        new Intl.DateTimeFormat('en-US', {dateStyle: 'long'}).format(
          new Date('2026-09-12T02:30:00Z'),
        ),
      ).toBe('September 11, 2026');

      // The original route built its formatter when the module loaded, so load
      // the route fresh, under the other time zone.
      vi.resetModules();
      const {default: BlogInLosAngeles} =
        await import('../../routes/blogs.$blogHandle._index');
      const html = await renderRoute({
        path: '/blogs/:blogHandle',
        url: `${ORIGIN}/blogs/journal`,
        Component: BlogInLosAngeles as never,
        loaderData: {blog: blog(), origin: ORIGIN},
      });

      expect(html).toContain('September 12, 2026');
      expect(html).not.toContain('September 11, 2026');
    });
  });
});

describe('blogs/:blogHandle/:articleHandle', () => {
  const articleData = (overrides: Record<string, unknown> = {}) => ({
    handle: 'sleep-better',
    title: 'How to sleep better',
    contentHtml: '<p>Full text.</p>',
    content: 'Full text.',
    excerpt: 'A short editor-written teaser.',
    publishedAt: '2026-09-12T02:30:00Z',
    author: {name: 'Ada'},
    image: {
      id: 'i1',
      url: 'https://cdn.shopify.com/s/a.jpg',
      altText: 'Bed',
      width: 1200,
      height: 800,
    },
    seo: {title: null, description: null},
    ...overrides,
  });
  const blogData = (article: unknown = articleData()) => ({
    handle: 'sleep-journal',
    title: 'Sleep Journal',
    articleByHandle: article,
  });

  function load(
    data: unknown,
    params = {blogHandle: 'sleep-journal', articleHandle: 'sleep-better'},
  ) {
    const storefront = createFakeStorefront(data);
    const promise = callRoute(articleLoader, {
      request: new Request(
        `${ORIGIN}/blogs/${params.blogHandle}/${params.articleHandle}`,
      ),
      context: {storefront},
      params,
    });
    return {promise, storefront};
  }

  it('returns the real blog title (not one derived from the handle) and the origin', async () => {
    const {promise, storefront} = load({blog: blogData()});

    expect(await promise).toEqual({
      article: articleData(),
      blogHandle: 'sleep-journal',
      blogTitle: 'Sleep Journal',
      origin: ORIGIN,
    });
    expectValidStorefrontDocument(storefront.query.mock.calls[0][0]);
  });

  it.each([{blog: null}, {blog: blogData(null)}])(
    'answers 404 when the blog or article is missing: %j',
    async (data) => {
      const {promise} = load(data);
      expect((await thrownResponse(promise)).status).toBe(404);
    },
  );

  const metaData = () => ({
    article: articleData(),
    blogHandle: 'sleep-journal',
    blogTitle: 'Sleep Journal',
    origin: ORIGIN,
  });

  it('has article Open Graph tags and an absolute canonical', () => {
    expect(tags(articleMeta, metaData())).toEqual([
      {title: 'How to sleep better | Mellow'},
      {name: 'description', content: 'A short editor-written teaser.'},
      {property: 'og:title', content: 'How to sleep better | Mellow'},
      {property: 'og:description', content: 'A short editor-written teaser.'},
      {property: 'og:type', content: 'article'},
      {property: 'og:image', content: 'https://cdn.shopify.com/s/a.jpg'},
      {property: 'article:published_time', content: '2026-09-12T02:30:00Z'},
      {
        tagName: 'link',
        rel: 'canonical',
        href: `${ORIGIN}/blogs/sleep-journal/sleep-better`,
      },
    ]);
  });

  it('chooses the description from SEO, then excerpt, then the article text', () => {
    const description = (article: Record<string, unknown>) =>
      tags(articleMeta, {...metaData(), article: articleData(article)}).find(
        (tag) => tag.name === 'description',
      )?.content;

    expect(description({seo: {title: null, description: 'From SEO'}})).toBe(
      'From SEO',
    );
    expect(description({})).toBe('A short editor-written teaser.');
    expect(description({excerpt: null})).toBe('Full text.');
  });

  it('only advertises https images', () => {
    const relative = articleData({
      image: {
        id: 'i',
        url: '/images/a.svg',
        altText: null,
        width: 1,
        height: 1,
      },
    });
    const result = tags(articleMeta, {...metaData(), article: relative});
    expect(result.some((tag) => tag.property === 'og:image')).toBe(false);
  });

  it('is a noindex "not found" page when the loader threw', () => {
    expect(tags(articleMeta, undefined)).toEqual([
      {title: 'Article not found | Mellow'},
      ...NOT_FOUND_BASE,
    ]);
  });

  describe('page', () => {
    function render() {
      return renderRoute({
        path: '/blogs/:blogHandle/:articleHandle',
        url: `${ORIGIN}/blogs/sleep-journal/sleep-better`,
        Component: Article as never,
        loaderData: {...metaData()},
      });
    }

    it('names the blog by its title in the breadcrumb and the footer button', async () => {
      const html = await render();

      expect(html).toContain('>Sleep Journal</a>');
      expect(html).toContain('More from Sleep Journal');
      // The old code turned the handle into "Sleep journal".
      expect(html).not.toContain('Sleep journal');
      expect(html).toContain('href="/blogs/sleep-journal"');
    });

    it('formats the publish date in UTC whatever the time zone of the renderer', async () => {
      vi.stubEnv('TZ', 'America/Los_Angeles');
      expect(
        new Intl.DateTimeFormat('en-US', {dateStyle: 'long'}).format(
          new Date('2026-09-12T02:30:00Z'),
        ),
      ).toBe('September 11, 2026');

      const html = await render();

      expect(html).toContain('September 12, 2026');
      expect(html).toContain('dateTime="2026-09-12T02:30:00Z"');
      expect(html).toContain('By Ada');
    });
  });
});
