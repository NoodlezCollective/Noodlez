/**
 * Root resolvers (Query + Mutation) for the development Storefront API mock.
 */
import {
  addLines,
  buildCartObject,
  createCart,
  ensureCart,
  getCart,
  removeLines,
  updateAttributes,
  updateBuyerIdentity,
  updateDiscountCodes,
  updateLines,
  updateNote,
  type StoredCart,
} from './cart.server';
import {
  applyProductFilters,
  connection,
  searchProducts,
  sortProducts,
  type GqlObject,
  type MockCatalog,
  type PaginationArgs,
} from './graph.server';

export function createRootValue(catalog: MockCatalog, origin: string): GqlObject {
  const cartPayload = (cart: StoredCart | null, userErrors: GqlObject[] = []) => ({
    cart: cart ? buildCartObject(cart, catalog, origin) : null,
    userErrors,
    warnings: [],
  });

  const withCart = (
    cartId: string,
    mutate: (cart: StoredCart) => StoredCart,
  ) => cartPayload(mutate(ensureCart(cartId)));

  const unsupported = (cartId: string, message: string) =>
    cartPayload(ensureCart(cartId), [
      {
        __typename: 'CartUserError',
        code: 'INVALID',
        field: null,
        message: `${message} by the development mock.`,
      },
    ]);

  const normalizeTypes = (types?: string[] | null) =>
    new Set((types ?? ['PRODUCT', 'PAGE', 'ARTICLE']).map((type) => type.toUpperCase()));

  return {
    /* ------------------------------ Query ------------------------------ */
    shop: catalog.shop,
    localization: catalog.localization,
    publicApiVersions: [],
    paymentSettings: catalog.shop.paymentSettings,
    customer: () => null,
    locations: (args: PaginationArgs) => connection([], args),

    menu: ({handle}: {handle: string}) => catalog.menusByHandle.get(handle) ?? null,

    product: ({handle, id}: {handle?: string | null; id?: string | null}) =>
      (handle ? catalog.productsByHandle.get(handle) : null) ??
      (id ? catalog.registry.resolveNode(id) : null) ??
      null,
    productByHandle: ({handle}: {handle: string}) => catalog.productsByHandle.get(handle) ?? null,
    products: (args: PaginationArgs & {sortKey?: string; reverse?: boolean; query?: string | null}) => {
      const base = args.query ? searchProducts(catalog.products, args.query) : catalog.products;
      return connection(sortProducts(base, args.sortKey ?? 'ID', args.reverse ?? false), args, {
        filters: [],
      });
    },
    productRecommendations: ({productId, productHandle}: {productId?: string | null; productHandle?: string | null}) => {
      const product =
        (productId ? catalog.registry.resolveNode(productId) : null) ??
        (productHandle ? catalog.productsByHandle.get(productHandle) : null);
      if (!product) return [];
      const handles = new Set(product.__collections as string[]);
      const related = catalog.products.filter(
        (candidate) =>
          candidate !== product &&
          (candidate.__collections as string[]).some((handle) => handles.has(handle) && handle !== 'all'),
      );
      const rest = catalog.products.filter((candidate) => candidate !== product && !related.includes(candidate));
      return [...related, ...rest].slice(0, 8);
    },
    productTags: (args: PaginationArgs) =>
      connection([...new Set(catalog.products.flatMap((p) => p.tags as string[]))].sort(), args),
    productTypes: (args: PaginationArgs) =>
      connection([...new Set(catalog.products.map((p) => p.productType as string))].sort(), args),

    collection: ({handle, id}: {handle?: string | null; id?: string | null}) =>
      (handle ? catalog.collectionsByHandle.get(handle) : null) ??
      (id ? catalog.registry.resolveNode(id) : null) ??
      null,
    collectionByHandle: ({handle}: {handle: string}) => catalog.collectionsByHandle.get(handle) ?? null,
    collections: (args: PaginationArgs & {sortKey?: string; reverse?: boolean; query?: string | null}) => {
      let items = catalog.collections.filter((collection) => collection.handle !== 'all');
      if (args.query) {
        const q = args.query.toLowerCase();
        items = items.filter((collection) => String(collection.title).toLowerCase().includes(q));
      }
      if (args.sortKey === 'TITLE') {
        items = [...items].sort((a, b) => String(a.title).localeCompare(String(b.title)));
      }
      if (args.reverse) items = [...items].reverse();
      return connection(items, args);
    },

    page: ({handle, id}: {handle?: string | null; id?: string | null}) =>
      catalog.pages.find((page) => page.handle === handle || page.id === id) ?? null,
    pageByHandle: ({handle}: {handle: string}) => catalog.pages.find((page) => page.handle === handle) ?? null,
    pages: (args: PaginationArgs) => connection(catalog.pages, args),

    blog: () => null,
    blogByHandle: () => null,
    blogs: (args: PaginationArgs) => connection([], args),
    article: () => null,
    articles: (args: PaginationArgs) => connection([], args),

    metaobject: ({handle, id}: {handle?: {type: string; handle: string} | null; id?: string | null}) =>
      (id ? catalog.registry.resolveNode(id) : null) ??
      (handle
        ? catalog.metaobjects.find((m) => m.type === handle.type && m.handle === handle.handle)
        : null) ??
      null,
    metaobjects: ({type, ...args}: PaginationArgs & {type: string; sortKey?: string; reverse?: boolean}) =>
      connection(
        catalog.metaobjects.filter((metaobject) => metaobject.type === type),
        args,
      ),

    search: (
      args: PaginationArgs & {
        query: string;
        types?: string[] | null;
        sortKey?: string;
        reverse?: boolean;
        productFilters?: GqlObject[] | null;
        unavailableProducts?: string | null;
      },
    ) => {
      const types = normalizeTypes(args.types);
      const items: GqlObject[] = [];
      if (types.has('PRODUCT')) {
        let products = searchProducts(catalog.products, args.query);
        if (args.unavailableProducts === 'HIDE') {
          products = products.filter((product) => product.availableForSale);
        }
        products = applyProductFilters(products, args.productFilters);
        items.push(...sortProducts(products, args.sortKey ?? 'RELEVANCE', args.reverse ?? false));
      }
      if (types.has('PAGE')) {
        const q = args.query.toLowerCase();
        items.push(
          ...catalog.pages.filter(
            (page) =>
              String(page.title).toLowerCase().includes(q) ||
              String(page.bodySummary).toLowerCase().includes(q),
          ),
        );
      }
      return connection(items, args, {productFilters: []});
    },

    predictiveSearch: ({query, limit, types}: {query: string; limit?: number | null; types?: string[] | null}) => {
      const max = limit ?? 10;
      const requested = normalizeTypes(types?.length ? types : ['PRODUCT', 'COLLECTION', 'PAGE', 'QUERY']);
      const q = query.toLowerCase();
      const products = requested.has('PRODUCT') ? searchProducts(catalog.products, query).slice(0, max) : [];
      const collections = requested.has('COLLECTION')
        ? catalog.collections.filter((c) => String(c.title).toLowerCase().includes(q)).slice(0, max)
        : [];
      const pages = requested.has('PAGE')
        ? catalog.pages.filter((p) => String(p.title).toLowerCase().includes(q)).slice(0, max)
        : [];
      const queries = requested.has('QUERY')
        ? [...new Set(products.map((p) => String(p.productType).toLowerCase()))].slice(0, 3).map((text) => ({
            __typename: 'SearchQuerySuggestion',
            text,
            styledText: text.replace(q, `<mark>${q}</mark>`),
            trackingParameters: null,
          }))
        : [];
      return {
        __typename: 'PredictiveSearchResult',
        articles: [],
        collections,
        pages,
        products,
        queries,
      };
    },

    urlRedirects: (args: PaginationArgs) => connection([], args),
    node: ({id}: {id: string}) => catalog.registry.resolveNode(id),
    nodes: ({ids}: {ids: string[]}) => ids.map((id) => catalog.registry.resolveNode(id)),
    sitemap: ({type}: {type: string}) => ({
      __typename: 'Sitemap',
      pagesCount: {__typename: 'Count', count: 0, precision: 'EXACT'},
      resources: () => ({__typename: 'SitemapPage', items: []}),
      __type: type,
    }),

    cart: ({id}: {id: string}) => {
      const cart = getCart(id);
      return cart ? buildCartObject(cart, catalog, origin) : null;
    },
    cartCompletionAttempt: () => null,

    /* ---------------------------- Mutation ----------------------------- */
    cartCreate: ({input}: {input?: GqlObject}) => cartPayload(createCart(input ?? {})),
    cartLinesAdd: ({cartId, lines}: {cartId: string; lines: GqlObject[]}) =>
      withCart(cartId, (cart) => addLines(cart, lines)),
    cartLinesUpdate: ({cartId, lines}: {cartId: string; lines: GqlObject[]}) =>
      withCart(cartId, (cart) => updateLines(cart, lines)),
    cartLinesRemove: ({cartId, lineIds}: {cartId: string; lineIds: string[]}) =>
      withCart(cartId, (cart) => removeLines(cart, lineIds)),
    cartDiscountCodesUpdate: ({cartId, discountCodes}: {cartId: string; discountCodes?: string[] | null}) =>
      withCart(cartId, (cart) => updateDiscountCodes(cart, discountCodes ?? [])),
    cartNoteUpdate: ({cartId, note}: {cartId: string; note?: string | null}) =>
      withCart(cartId, (cart) => updateNote(cart, note ?? null)),
    cartAttributesUpdate: ({cartId, attributes}: {cartId: string; attributes: StoredCart['attributes']}) =>
      withCart(cartId, (cart) => updateAttributes(cart, attributes ?? [])),
    cartBuyerIdentityUpdate: ({cartId, buyerIdentity}: {cartId: string; buyerIdentity: GqlObject}) =>
      withCart(cartId, (cart) => updateBuyerIdentity(cart, buyerIdentity ?? {})),
    cartSelectedDeliveryOptionsUpdate: ({cartId}: {cartId: string}) => withCart(cartId, (cart) => cart),
    cartDeliveryAddressesAdd: ({cartId}: {cartId: string}) => withCart(cartId, (cart) => cart),
    cartDeliveryAddressesRemove: ({cartId}: {cartId: string}) => withCart(cartId, (cart) => cart),
    cartDeliveryAddressesUpdate: ({cartId}: {cartId: string}) => withCart(cartId, (cart) => cart),
    cartDeliveryAddressesReplace: ({cartId}: {cartId: string}) => withCart(cartId, (cart) => cart),
    cartBillingAddressUpdate: ({cartId}: {cartId: string}) => withCart(cartId, (cart) => cart),
    cartGiftCardCodesAdd: ({cartId}: {cartId: string}) => unsupported(cartId, 'Gift cards are not supported'),
    cartGiftCardCodesRemove: ({cartId}: {cartId: string}) => unsupported(cartId, 'Gift cards are not supported'),
    cartGiftCardCodesUpdate: ({cartId}: {cartId: string}) => unsupported(cartId, 'Gift cards are not supported'),
    cartMetafieldsSet: () => ({metafields: [], userErrors: []}),
    cartMetafieldDelete: () => ({deletedId: null, userErrors: []}),
    cartPaymentUpdate: ({cartId}: {cartId: string}) => unsupported(cartId, 'Payment updates are not supported'),
    cartPrepareForCompletion: () => ({result: null, userErrors: []}),
    cartSubmitForCompletion: () => ({result: null, userErrors: []}),
    cartRemovePersonalData: ({cartId}: {cartId: string}) => withCart(cartId, (cart) => cart),
    cartClone: ({cartId}: {cartId: string}) => withCart(cartId, (cart) => cart),
  };
}
