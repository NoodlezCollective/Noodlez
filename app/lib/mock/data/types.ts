export type OptionSeed = {
  name: string;
  values: Array<{name: string; swatchColor?: string}>;
};

export type VariantSeed = {
  id: string;
  sku?: string;
  price: number;
  compareAtPrice?: number | null;
  availableForSale?: boolean;
  quantityAvailable?: number;
  selectedOptions: Array<{name: string; value: string}>;
  /** Index into the product's image list. */
  imageIndex?: number;
};

export type MetafieldSeed = {
  namespace: string;
  key: string;
  type: string;
  value: string;
  /** Referenced node ids for *_reference types. */
  references?: string[];
};

export type ImageSeed = {
  id: string;
  url: string;
  altText: string;
  width: number;
  height: number;
};

export type ProductSeed = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  description: string;
  descriptionHtml: string;
  images: ImageSeed[];
  options: OptionSeed[];
  variants: VariantSeed[];
  collections: string[];
  metafields: MetafieldSeed[];
  createdAt: string;
  updatedAt: string;
  /** Lower ranks sell better (used for BEST_SELLING sort). */
  bestSellingRank: number;
};

export type CollectionSeed = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  image: ImageSeed | null;
  updatedAt: string;
  /** Overrides product order for COLLECTION_DEFAULT / MANUAL sorting. */
  productOrder?: string[];
};

export type MenuItemSeed = {
  id: string;
  title: string;
  url: string;
  type: string;
  resourceId?: string | null;
  items?: MenuItemSeed[];
};

export type MenuSeed = {
  id: string;
  handle: string;
  title: string;
  items: MenuItemSeed[];
};

export type PageSeed = {
  id: string;
  handle: string;
  title: string;
  body: string;
  bodySummary: string;
  seo: {title: string | null; description: string | null};
  updatedAt: string;
  createdAt: string;
};

export type PolicySeed = {
  id: string;
  handle: string;
  title: string;
  body: string;
};

export type MetaobjectFieldSeed = {
  key: string;
  type: string;
  value: string | null;
  reference?: string | null;
  references?: string[];
};

export type MetaobjectSeed = {
  id: string;
  handle: string;
  type: string;
  fields: MetaobjectFieldSeed[];
};

export type MediaImageSeed = {
  id: string;
  image: ImageSeed;
};
