/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as StorefrontAPI from '@shopify/hydrogen-react/storefront-api-types';

export type ShopDataQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type ShopDataQuery = {
  shop: Pick<StorefrontAPI.Shop, 'id'>;
  localization: {
    country: {currency: Pick<StorefrontAPI.Currency, 'isoCode'>};
    language: Pick<StorefrontAPI.Language, 'isoCode'>;
  };
};

export type CartApiMutationFragment = Pick<
  StorefrontAPI.Cart,
  'id' | 'totalQuantity' | 'checkoutUrl'
>;

export type CartApiErrorFragment = Pick<
  StorefrontAPI.CartUserError,
  'message' | 'field' | 'code'
>;

export type CartApiWarningFragment = Pick<
  StorefrontAPI.CartWarning,
  'code' | 'message' | 'target'
>;

export type CartQueryQueryVariables = StorefrontAPI.Exact<{
  cartId: StorefrontAPI.Scalars['ID']['input'];
  numCartLines?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['Int']['input']
  >;
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CartQueryQuery = {
  cart?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Cart,
      'updatedAt' | 'id' | 'checkoutUrl' | 'totalQuantity' | 'note'
    > & {
      appliedGiftCards: Array<
        Pick<StorefrontAPI.AppliedGiftCard, 'id' | 'lastCharacters'> & {
          amountUsed: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
        }
      >;
      buyerIdentity: Pick<
        StorefrontAPI.CartBuyerIdentity,
        'countryCode' | 'email' | 'phone'
      > & {
        customer?: StorefrontAPI.Maybe<
          Pick<
            StorefrontAPI.Customer,
            'id' | 'email' | 'firstName' | 'lastName' | 'displayName'
          >
        >;
      };
      lines: {
        nodes: Array<
          | (Pick<StorefrontAPI.CartLine, 'id' | 'quantity'> & {
              attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
              cost: {
                totalAmount: Pick<
                  StorefrontAPI.MoneyV2,
                  'currencyCode' | 'amount'
                >;
                amountPerQuantity: Pick<
                  StorefrontAPI.MoneyV2,
                  'currencyCode' | 'amount'
                >;
                compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                >;
              };
              merchandise: Pick<
                StorefrontAPI.ProductVariant,
                'id' | 'availableForSale' | 'requiresShipping' | 'title'
              > & {
                compareAtPrice?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                >;
                price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
                image?: StorefrontAPI.Maybe<
                  Pick<
                    StorefrontAPI.Image,
                    'id' | 'url' | 'altText' | 'width' | 'height'
                  >
                >;
                product: Pick<
                  StorefrontAPI.Product,
                  'handle' | 'title' | 'id' | 'vendor'
                >;
                selectedOptions: Array<
                  Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
                >;
              };
              parentRelationship?: StorefrontAPI.Maybe<{
                parent: Pick<StorefrontAPI.CartLine, 'id'>;
              }>;
            })
          | (Pick<StorefrontAPI.ComponentizableCartLine, 'id' | 'quantity'> & {
              attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
              cost: {
                totalAmount: Pick<
                  StorefrontAPI.MoneyV2,
                  'currencyCode' | 'amount'
                >;
                amountPerQuantity: Pick<
                  StorefrontAPI.MoneyV2,
                  'currencyCode' | 'amount'
                >;
                compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                >;
              };
              merchandise: Pick<
                StorefrontAPI.ProductVariant,
                'id' | 'availableForSale' | 'requiresShipping' | 'title'
              > & {
                compareAtPrice?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                >;
                price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
                image?: StorefrontAPI.Maybe<
                  Pick<
                    StorefrontAPI.Image,
                    'id' | 'url' | 'altText' | 'width' | 'height'
                  >
                >;
                product: Pick<
                  StorefrontAPI.Product,
                  'handle' | 'title' | 'id' | 'vendor'
                >;
                selectedOptions: Array<
                  Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
                >;
              };
              lineComponents: Array<
                Pick<StorefrontAPI.CartLine, 'id' | 'quantity'> & {
                  attributes: Array<
                    Pick<StorefrontAPI.Attribute, 'key' | 'value'>
                  >;
                  cost: {
                    totalAmount: Pick<
                      StorefrontAPI.MoneyV2,
                      'currencyCode' | 'amount'
                    >;
                    amountPerQuantity: Pick<
                      StorefrontAPI.MoneyV2,
                      'currencyCode' | 'amount'
                    >;
                    compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
                      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                    >;
                  };
                  merchandise: Pick<
                    StorefrontAPI.ProductVariant,
                    'id' | 'availableForSale' | 'requiresShipping' | 'title'
                  > & {
                    compareAtPrice?: StorefrontAPI.Maybe<
                      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                    >;
                    price: Pick<
                      StorefrontAPI.MoneyV2,
                      'currencyCode' | 'amount'
                    >;
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'id' | 'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                    product: Pick<
                      StorefrontAPI.Product,
                      'handle' | 'title' | 'id' | 'vendor'
                    >;
                    selectedOptions: Array<
                      Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
                    >;
                  };
                  parentRelationship?: StorefrontAPI.Maybe<{
                    parent: Pick<StorefrontAPI.CartLine, 'id'>;
                  }>;
                }
              >;
            })
        >;
      };
      cost: {
        subtotalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
        totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
        totalDutyAmount?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
        >;
        totalTaxAmount?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
        >;
      };
      attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
      discountCodes: Array<
        Pick<StorefrontAPI.CartDiscountCode, 'code' | 'applicable'>
      >;
      discountAllocations: Array<{
        discountedAmount: Pick<
          StorefrontAPI.MoneyV2,
          'currencyCode' | 'amount'
        >;
      }>;
    }
  >;
};

export type CartCreateMutationVariables = StorefrontAPI.Exact<{
  input: StorefrontAPI.CartInput;
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CartCreateMutation = {
  cartCreate?: StorefrontAPI.Maybe<{
    cart?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Cart, 'id' | 'totalQuantity' | 'checkoutUrl'>
    >;
    userErrors: Array<
      Pick<StorefrontAPI.CartUserError, 'message' | 'field' | 'code'>
    >;
    warnings: Array<
      Pick<StorefrontAPI.CartWarning, 'code' | 'message' | 'target'>
    >;
  }>;
};

export type CartLinesAddMutationVariables = StorefrontAPI.Exact<{
  cartId: StorefrontAPI.Scalars['ID']['input'];
  lines: Array<StorefrontAPI.CartLineInput> | StorefrontAPI.CartLineInput;
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CartLinesAddMutation = {
  cartLinesAdd?: StorefrontAPI.Maybe<{
    cart?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Cart, 'id' | 'totalQuantity' | 'checkoutUrl'>
    >;
    userErrors: Array<
      Pick<StorefrontAPI.CartUserError, 'message' | 'field' | 'code'>
    >;
    warnings: Array<
      Pick<StorefrontAPI.CartWarning, 'code' | 'message' | 'target'>
    >;
  }>;
};

export type CartLinesUpdateMutationVariables = StorefrontAPI.Exact<{
  cartId: StorefrontAPI.Scalars['ID']['input'];
  lines:
    | Array<StorefrontAPI.CartLineUpdateInput>
    | StorefrontAPI.CartLineUpdateInput;
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CartLinesUpdateMutation = {
  cartLinesUpdate?: StorefrontAPI.Maybe<{
    cart?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Cart, 'id' | 'totalQuantity' | 'checkoutUrl'>
    >;
    userErrors: Array<
      Pick<StorefrontAPI.CartUserError, 'message' | 'field' | 'code'>
    >;
    warnings: Array<
      Pick<StorefrontAPI.CartWarning, 'code' | 'message' | 'target'>
    >;
  }>;
};

export type CartLinesRemoveMutationVariables = StorefrontAPI.Exact<{
  cartId: StorefrontAPI.Scalars['ID']['input'];
  lineIds:
    | Array<StorefrontAPI.Scalars['ID']['input']>
    | StorefrontAPI.Scalars['ID']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CartLinesRemoveMutation = {
  cartLinesRemove?: StorefrontAPI.Maybe<{
    cart?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Cart, 'id' | 'totalQuantity' | 'checkoutUrl'>
    >;
    userErrors: Array<
      Pick<StorefrontAPI.CartUserError, 'message' | 'field' | 'code'>
    >;
    warnings: Array<
      Pick<StorefrontAPI.CartWarning, 'code' | 'message' | 'target'>
    >;
  }>;
};

export type CartDiscountCodesUpdateMutationVariables = StorefrontAPI.Exact<{
  cartId: StorefrontAPI.Scalars['ID']['input'];
  discountCodes:
    | Array<StorefrontAPI.Scalars['String']['input']>
    | StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CartDiscountCodesUpdateMutation = {
  cartDiscountCodesUpdate?: StorefrontAPI.Maybe<{
    cart?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Cart, 'id' | 'totalQuantity' | 'checkoutUrl'>
    >;
    userErrors: Array<
      Pick<StorefrontAPI.CartUserError, 'message' | 'field' | 'code'>
    >;
    warnings: Array<
      Pick<StorefrontAPI.CartWarning, 'code' | 'message' | 'target'>
    >;
  }>;
};

export type CartGiftCardCodesAddMutationVariables = StorefrontAPI.Exact<{
  cartId: StorefrontAPI.Scalars['ID']['input'];
  giftCardCodes:
    | Array<StorefrontAPI.Scalars['String']['input']>
    | StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CartGiftCardCodesAddMutation = {
  cartGiftCardCodesAdd?: StorefrontAPI.Maybe<{
    cart?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Cart, 'id' | 'totalQuantity' | 'checkoutUrl'>
    >;
    userErrors: Array<
      Pick<StorefrontAPI.CartUserError, 'message' | 'field' | 'code'>
    >;
    warnings: Array<
      Pick<StorefrontAPI.CartWarning, 'code' | 'message' | 'target'>
    >;
  }>;
};

export type CartGiftCardCodesRemoveMutationVariables = StorefrontAPI.Exact<{
  cartId: StorefrontAPI.Scalars['ID']['input'];
  appliedGiftCardIds:
    | Array<StorefrontAPI.Scalars['ID']['input']>
    | StorefrontAPI.Scalars['ID']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CartGiftCardCodesRemoveMutation = {
  cartGiftCardCodesRemove?: StorefrontAPI.Maybe<{
    cart?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Cart, 'id' | 'totalQuantity' | 'checkoutUrl'>
    >;
    userErrors: Array<
      Pick<StorefrontAPI.CartUserError, 'message' | 'field' | 'code'>
    >;
    warnings: Array<
      Pick<StorefrontAPI.CartWarning, 'code' | 'message' | 'target'>
    >;
  }>;
};

export type CartBuyerIdentityUpdateMutationVariables = StorefrontAPI.Exact<{
  cartId: StorefrontAPI.Scalars['ID']['input'];
  buyerIdentity: StorefrontAPI.CartBuyerIdentityInput;
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type CartBuyerIdentityUpdateMutation = {
  cartBuyerIdentityUpdate?: StorefrontAPI.Maybe<{
    cart?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Cart, 'id' | 'totalQuantity' | 'checkoutUrl'>
    >;
    userErrors: Array<
      Pick<StorefrontAPI.CartUserError, 'message' | 'field' | 'code'>
    >;
    warnings: Array<
      Pick<StorefrontAPI.CartWarning, 'code' | 'message' | 'target'>
    >;
  }>;
};

export type CollectionFilterFragment = Pick<
  StorefrontAPI.Filter,
  'id' | 'label' | 'type' | 'presentation'
> & {
  values: Array<
    Pick<StorefrontAPI.FilterValue, 'id' | 'label' | 'count' | 'input'> & {
      swatch?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Swatch, 'color'>>;
    }
  >;
};

type MellowReference_Article_Model3d_ProductVariant_Fragment = {
  __typename: 'Article' | 'Model3d' | 'ProductVariant';
};

type MellowReference_Collection_Fragment = {__typename: 'Collection'} & Pick<
  StorefrontAPI.Collection,
  'id' | 'handle' | 'title'
>;

type MellowReference_GenericFile_Fragment = {__typename: 'GenericFile'} & Pick<
  StorefrontAPI.GenericFile,
  'id' | 'url' | 'mimeType'
>;

type MellowReference_MediaImage_Fragment = {__typename: 'MediaImage'} & Pick<
  StorefrontAPI.MediaImage,
  'id'
> & {
    image?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
    >;
  };

type MellowReference_Metaobject_Fragment = {__typename: 'Metaobject'} & Pick<
  StorefrontAPI.Metaobject,
  'id' | 'handle' | 'type'
> & {
    fields: Array<
      Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
        reference?: StorefrontAPI.Maybe<
          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
              image?: StorefrontAPI.Maybe<
                Pick<
                  StorefrontAPI.Image,
                  'url' | 'altText' | 'width' | 'height'
                >
              >;
            })
          | Pick<StorefrontAPI.Product, 'id' | 'handle' | 'title'>
          | (Pick<StorefrontAPI.Video, 'id'> & {
              sources: Array<
                Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
              >;
              previewImage?: StorefrontAPI.Maybe<
                Pick<
                  StorefrontAPI.Image,
                  'url' | 'altText' | 'width' | 'height'
                >
              >;
            })
        >;
      }
    >;
  };

type MellowReference_Page_Fragment = {__typename: 'Page'} & Pick<
  StorefrontAPI.Page,
  'id' | 'handle' | 'title'
>;

type MellowReference_Product_Fragment = {__typename: 'Product'} & Pick<
  StorefrontAPI.Product,
  'id' | 'handle' | 'title'
>;

type MellowReference_Video_Fragment = {__typename: 'Video'} & Pick<
  StorefrontAPI.Video,
  'id'
> & {
    sources: Array<Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>>;
    previewImage?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
    >;
  };

export type MellowReferenceFragment =
  | MellowReference_Article_Model3d_ProductVariant_Fragment
  | MellowReference_Collection_Fragment
  | MellowReference_GenericFile_Fragment
  | MellowReference_MediaImage_Fragment
  | MellowReference_Metaobject_Fragment
  | MellowReference_Page_Fragment
  | MellowReference_Product_Fragment
  | MellowReference_Video_Fragment;

export type MellowMetaobjectFragment = Pick<
  StorefrontAPI.Metaobject,
  'id' | 'handle' | 'type'
> & {
  fields: Array<
    Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
      reference?: StorefrontAPI.Maybe<
        | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
        | ({__typename: 'Collection'} & Pick<
            StorefrontAPI.Collection,
            'id' | 'handle' | 'title'
          >)
        | ({__typename: 'GenericFile'} & Pick<
            StorefrontAPI.GenericFile,
            'id' | 'url' | 'mimeType'
          >)
        | ({__typename: 'MediaImage'} & Pick<StorefrontAPI.MediaImage, 'id'> & {
              image?: StorefrontAPI.Maybe<
                Pick<
                  StorefrontAPI.Image,
                  'url' | 'altText' | 'width' | 'height'
                >
              >;
            })
        | ({__typename: 'Metaobject'} & Pick<
            StorefrontAPI.Metaobject,
            'id' | 'handle' | 'type'
          > & {
              fields: Array<
                Pick<
                  StorefrontAPI.MetaobjectField,
                  'key' | 'type' | 'value'
                > & {
                  reference?: StorefrontAPI.Maybe<
                    | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                        image?: StorefrontAPI.Maybe<
                          Pick<
                            StorefrontAPI.Image,
                            'url' | 'altText' | 'width' | 'height'
                          >
                        >;
                      })
                    | Pick<StorefrontAPI.Product, 'id' | 'handle' | 'title'>
                    | (Pick<StorefrontAPI.Video, 'id'> & {
                        sources: Array<
                          Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                        >;
                        previewImage?: StorefrontAPI.Maybe<
                          Pick<
                            StorefrontAPI.Image,
                            'url' | 'altText' | 'width' | 'height'
                          >
                        >;
                      })
                  >;
                }
              >;
            })
        | ({__typename: 'Page'} & Pick<
            StorefrontAPI.Page,
            'id' | 'handle' | 'title'
          >)
        | ({__typename: 'Product'} & Pick<
            StorefrontAPI.Product,
            'id' | 'handle' | 'title'
          >)
        | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
              sources: Array<
                Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
              >;
              previewImage?: StorefrontAPI.Maybe<
                Pick<
                  StorefrontAPI.Image,
                  'url' | 'altText' | 'width' | 'height'
                >
              >;
            })
      >;
    }
  >;
};

export type HomeContentQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type HomeContentQuery = {
  settings: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
  hero: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
  pressLogos: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
  story: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
  ugcVideos: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
  lifestyle: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
  testimonials: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
  faqs: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
};

export type SiteSettingsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type SiteSettingsQuery = {
  settings: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
};

export type AboutContentQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type AboutContentQuery = {
  about: {
    nodes: Array<
      Pick<StorefrontAPI.Metaobject, 'id' | 'handle' | 'type'> & {
        fields: Array<
          Pick<StorefrontAPI.MetaobjectField, 'key' | 'type' | 'value'> & {
            reference?: StorefrontAPI.Maybe<
              | {__typename: 'Article' | 'Model3d' | 'ProductVariant'}
              | ({__typename: 'Collection'} & Pick<
                  StorefrontAPI.Collection,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'GenericFile'} & Pick<
                  StorefrontAPI.GenericFile,
                  'id' | 'url' | 'mimeType'
                >)
              | ({__typename: 'MediaImage'} & Pick<
                  StorefrontAPI.MediaImage,
                  'id'
                > & {
                    image?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
              | ({__typename: 'Metaobject'} & Pick<
                  StorefrontAPI.Metaobject,
                  'id' | 'handle' | 'type'
                > & {
                    fields: Array<
                      Pick<
                        StorefrontAPI.MetaobjectField,
                        'key' | 'type' | 'value'
                      > & {
                        reference?: StorefrontAPI.Maybe<
                          | (Pick<StorefrontAPI.MediaImage, 'id'> & {
                              image?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                          | Pick<
                              StorefrontAPI.Product,
                              'id' | 'handle' | 'title'
                            >
                          | (Pick<StorefrontAPI.Video, 'id'> & {
                              sources: Array<
                                Pick<
                                  StorefrontAPI.VideoSource,
                                  'url' | 'mimeType'
                                >
                              >;
                              previewImage?: StorefrontAPI.Maybe<
                                Pick<
                                  StorefrontAPI.Image,
                                  'url' | 'altText' | 'width' | 'height'
                                >
                              >;
                            })
                        >;
                      }
                    >;
                  })
              | ({__typename: 'Page'} & Pick<
                  StorefrontAPI.Page,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Product'} & Pick<
                  StorefrontAPI.Product,
                  'id' | 'handle' | 'title'
                >)
              | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id'> & {
                    sources: Array<
                      Pick<StorefrontAPI.VideoSource, 'url' | 'mimeType'>
                    >;
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<
                        StorefrontAPI.Image,
                        'url' | 'altText' | 'width' | 'height'
                      >
                    >;
                  })
            >;
          }
        >;
      }
    >;
  };
};

export type MoneyFragment = Pick<
  StorefrontAPI.MoneyV2,
  'currencyCode' | 'amount'
>;

export type CartLineFragment = Pick<
  StorefrontAPI.CartLine,
  'id' | 'quantity'
> & {
  attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
  cost: {
    totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    amountPerQuantity: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
  };
  merchandise: Pick<
    StorefrontAPI.ProductVariant,
    'id' | 'availableForSale' | 'requiresShipping' | 'title'
  > & {
    compareAtPrice?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
    price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    image?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
    >;
    product: Pick<StorefrontAPI.Product, 'handle' | 'title' | 'id' | 'vendor'>;
    selectedOptions: Array<
      Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
    >;
  };
  parentRelationship?: StorefrontAPI.Maybe<{
    parent: Pick<StorefrontAPI.CartLine, 'id'>;
  }>;
};

export type CartLineComponentFragment = Pick<
  StorefrontAPI.ComponentizableCartLine,
  'id' | 'quantity'
> & {
  attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
  cost: {
    totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    amountPerQuantity: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
  };
  merchandise: Pick<
    StorefrontAPI.ProductVariant,
    'id' | 'availableForSale' | 'requiresShipping' | 'title'
  > & {
    compareAtPrice?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
    price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    image?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
    >;
    product: Pick<StorefrontAPI.Product, 'handle' | 'title' | 'id' | 'vendor'>;
    selectedOptions: Array<
      Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
    >;
  };
  lineComponents: Array<
    Pick<StorefrontAPI.CartLine, 'id' | 'quantity'> & {
      attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
      cost: {
        totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
        amountPerQuantity: Pick<
          StorefrontAPI.MoneyV2,
          'currencyCode' | 'amount'
        >;
        compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
        >;
      };
      merchandise: Pick<
        StorefrontAPI.ProductVariant,
        'id' | 'availableForSale' | 'requiresShipping' | 'title'
      > & {
        compareAtPrice?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
        >;
        price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
        image?: StorefrontAPI.Maybe<
          Pick<
            StorefrontAPI.Image,
            'id' | 'url' | 'altText' | 'width' | 'height'
          >
        >;
        product: Pick<
          StorefrontAPI.Product,
          'handle' | 'title' | 'id' | 'vendor'
        >;
        selectedOptions: Array<
          Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
        >;
      };
      parentRelationship?: StorefrontAPI.Maybe<{
        parent: Pick<StorefrontAPI.CartLine, 'id'>;
      }>;
    }
  >;
};

export type CartApiQueryFragment = Pick<
  StorefrontAPI.Cart,
  'updatedAt' | 'id' | 'checkoutUrl' | 'totalQuantity' | 'note'
> & {
  appliedGiftCards: Array<
    Pick<StorefrontAPI.AppliedGiftCard, 'id' | 'lastCharacters'> & {
      amountUsed: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    }
  >;
  buyerIdentity: Pick<
    StorefrontAPI.CartBuyerIdentity,
    'countryCode' | 'email' | 'phone'
  > & {
    customer?: StorefrontAPI.Maybe<
      Pick<
        StorefrontAPI.Customer,
        'id' | 'email' | 'firstName' | 'lastName' | 'displayName'
      >
    >;
  };
  lines: {
    nodes: Array<
      | (Pick<StorefrontAPI.CartLine, 'id' | 'quantity'> & {
          attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
          cost: {
            totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
            amountPerQuantity: Pick<
              StorefrontAPI.MoneyV2,
              'currencyCode' | 'amount'
            >;
            compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
            >;
          };
          merchandise: Pick<
            StorefrontAPI.ProductVariant,
            'id' | 'availableForSale' | 'requiresShipping' | 'title'
          > & {
            compareAtPrice?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
            >;
            price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
            image?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
            product: Pick<
              StorefrontAPI.Product,
              'handle' | 'title' | 'id' | 'vendor'
            >;
            selectedOptions: Array<
              Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
            >;
          };
          parentRelationship?: StorefrontAPI.Maybe<{
            parent: Pick<StorefrontAPI.CartLine, 'id'>;
          }>;
        })
      | (Pick<StorefrontAPI.ComponentizableCartLine, 'id' | 'quantity'> & {
          attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
          cost: {
            totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
            amountPerQuantity: Pick<
              StorefrontAPI.MoneyV2,
              'currencyCode' | 'amount'
            >;
            compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
            >;
          };
          merchandise: Pick<
            StorefrontAPI.ProductVariant,
            'id' | 'availableForSale' | 'requiresShipping' | 'title'
          > & {
            compareAtPrice?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
            >;
            price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
            image?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
            product: Pick<
              StorefrontAPI.Product,
              'handle' | 'title' | 'id' | 'vendor'
            >;
            selectedOptions: Array<
              Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
            >;
          };
          lineComponents: Array<
            Pick<StorefrontAPI.CartLine, 'id' | 'quantity'> & {
              attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
              cost: {
                totalAmount: Pick<
                  StorefrontAPI.MoneyV2,
                  'currencyCode' | 'amount'
                >;
                amountPerQuantity: Pick<
                  StorefrontAPI.MoneyV2,
                  'currencyCode' | 'amount'
                >;
                compareAtAmountPerQuantity?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                >;
              };
              merchandise: Pick<
                StorefrontAPI.ProductVariant,
                'id' | 'availableForSale' | 'requiresShipping' | 'title'
              > & {
                compareAtPrice?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
                >;
                price: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
                image?: StorefrontAPI.Maybe<
                  Pick<
                    StorefrontAPI.Image,
                    'id' | 'url' | 'altText' | 'width' | 'height'
                  >
                >;
                product: Pick<
                  StorefrontAPI.Product,
                  'handle' | 'title' | 'id' | 'vendor'
                >;
                selectedOptions: Array<
                  Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
                >;
              };
              parentRelationship?: StorefrontAPI.Maybe<{
                parent: Pick<StorefrontAPI.CartLine, 'id'>;
              }>;
            }
          >;
        })
    >;
  };
  cost: {
    subtotalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    totalAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
    totalDutyAmount?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
    totalTaxAmount?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>
    >;
  };
  attributes: Array<Pick<StorefrontAPI.Attribute, 'key' | 'value'>>;
  discountCodes: Array<
    Pick<StorefrontAPI.CartDiscountCode, 'code' | 'applicable'>
  >;
  discountAllocations: Array<{
    discountedAmount: Pick<StorefrontAPI.MoneyV2, 'currencyCode' | 'amount'>;
  }>;
};

export type MoneyProductCardFragment = Pick<
  StorefrontAPI.MoneyV2,
  'amount' | 'currencyCode'
>;

export type ProductCardFragment = Pick<
  StorefrontAPI.Product,
  'id' | 'handle' | 'title' | 'vendor' | 'availableForSale' | 'description'
> & {
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
  >;
  priceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
  compareAtPriceRange: {
    minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  };
  badge?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  shortDescription?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Metafield, 'value'>
  >;
  rating?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  ratingCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
};

export type MenuItemFragment = Pick<
  StorefrontAPI.MenuItem,
  'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
>;

export type ChildMenuItemFragment = Pick<
  StorefrontAPI.MenuItem,
  'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
>;

export type ParentMenuItemFragment = Pick<
  StorefrontAPI.MenuItem,
  'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
> & {
  items: Array<
    Pick<
      StorefrontAPI.MenuItem,
      'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
    >
  >;
};

export type MenuFragment = Pick<StorefrontAPI.Menu, 'id'> & {
  items: Array<
    Pick<
      StorefrontAPI.MenuItem,
      'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
    > & {
      items: Array<
        Pick<
          StorefrontAPI.MenuItem,
          'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
        >
      >;
    }
  >;
};

export type ShopFragment = Pick<
  StorefrontAPI.Shop,
  'id' | 'name' | 'description'
> & {
  primaryDomain: Pick<StorefrontAPI.Domain, 'url'>;
  brand?: StorefrontAPI.Maybe<{
    logo?: StorefrontAPI.Maybe<{
      image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url'>>;
    }>;
  }>;
};

export type HeaderQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  headerMenuHandle: StorefrontAPI.Scalars['String']['input'];
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type HeaderQuery = {
  shop: Pick<StorefrontAPI.Shop, 'id' | 'name' | 'description'> & {
    primaryDomain: Pick<StorefrontAPI.Domain, 'url'>;
    brand?: StorefrontAPI.Maybe<{
      logo?: StorefrontAPI.Maybe<{
        image?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Image, 'url'>>;
      }>;
    }>;
  };
  menu?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Menu, 'id'> & {
      items: Array<
        Pick<
          StorefrontAPI.MenuItem,
          'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
        > & {
          items: Array<
            Pick<
              StorefrontAPI.MenuItem,
              'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
            >
          >;
        }
      >;
    }
  >;
};

export type FooterQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  footerMenuHandle: StorefrontAPI.Scalars['String']['input'];
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type FooterQuery = {
  menu?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Menu, 'id'> & {
      items: Array<
        Pick<
          StorefrontAPI.MenuItem,
          'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
        > & {
          items: Array<
            Pick<
              StorefrontAPI.MenuItem,
              'id' | 'resourceId' | 'tags' | 'title' | 'type' | 'url'
            >
          >;
        }
      >;
    }
  >;
};

export type SitemapProductsQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapProductsQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<StorefrontAPI.SitemapResourceMetaobject, 'handle' | 'updatedAt'>
      >;
    }>;
  };
};

export type SitemapCollectionsQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapCollectionsQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<StorefrontAPI.SitemapResourceMetaobject, 'handle' | 'updatedAt'>
      >;
    }>;
  };
};

export type SitemapArticlesQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapArticlesQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<StorefrontAPI.SitemapResourceMetaobject, 'handle' | 'updatedAt'>
      >;
    }>;
  };
};

export type SitemapPagesQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapPagesQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<StorefrontAPI.SitemapResourceMetaobject, 'handle' | 'updatedAt'>
      >;
    }>;
  };
};

export type SitemapBlogsQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapBlogsQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<StorefrontAPI.SitemapResourceMetaobject, 'handle' | 'updatedAt'>
      >;
    }>;
  };
};

export type SitemapMetaobjectsQueryVariables = StorefrontAPI.Exact<{
  page: StorefrontAPI.Scalars['Int']['input'];
}>;

export type SitemapMetaobjectsQuery = {
  sitemap: {
    resources?: StorefrontAPI.Maybe<{
      items: Array<
        | Pick<StorefrontAPI.SitemapResource, 'handle' | 'updatedAt'>
        | Pick<
            StorefrontAPI.SitemapResourceMetaobject,
            'type' | 'handle' | 'updatedAt'
          >
      >;
    }>;
  };
};

export type SitemapIndexQueryVariables = StorefrontAPI.Exact<{
  [key: string]: never;
}>;

export type SitemapIndexQuery = {
  products: {
    pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>;
  };
  collections: {
    pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>;
  };
  articles: {
    pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>;
  };
  pages: {pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>};
  blogs: {pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>};
  metaObjects: {
    pagesCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Count, 'count'>>;
  };
};

export type RedirectsQueryVariables = StorefrontAPI.Exact<{
  query?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['String']['input']>;
}>;

export type RedirectsQuery = {
  urlRedirects: {
    edges: Array<{node: Pick<StorefrontAPI.UrlRedirect, 'target'>}>;
  };
};

export type HomepageQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  featuredHandle: StorefrontAPI.Scalars['String']['input'];
  first: StorefrontAPI.Scalars['Int']['input'];
}>;

export type HomepageQuery = {
  featured?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Collection, 'id' | 'handle' | 'title'> & {
      products: {
        nodes: Array<
          Pick<
            StorefrontAPI.Product,
            | 'id'
            | 'handle'
            | 'title'
            | 'vendor'
            | 'availableForSale'
            | 'description'
          > & {
            featuredImage?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
            priceRange: {
              minVariantPrice: Pick<
                StorefrontAPI.MoneyV2,
                'amount' | 'currencyCode'
              >;
            };
            compareAtPriceRange: {
              minVariantPrice: Pick<
                StorefrontAPI.MoneyV2,
                'amount' | 'currencyCode'
              >;
            };
            badge?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
            shortDescription?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
            rating?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
            ratingCount?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
          }
        >;
      };
    }
  >;
  bestSellers: {
    nodes: Array<
      Pick<
        StorefrontAPI.Product,
        | 'id'
        | 'handle'
        | 'title'
        | 'vendor'
        | 'availableForSale'
        | 'description'
      > & {
        featuredImage?: StorefrontAPI.Maybe<
          Pick<
            StorefrontAPI.Image,
            'id' | 'url' | 'altText' | 'width' | 'height'
          >
        >;
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        compareAtPriceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        badge?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        shortDescription?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
        rating?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        ratingCount?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
      }
    >;
  };
};

export type ArticleQueryVariables = StorefrontAPI.Exact<{
  articleHandle: StorefrontAPI.Scalars['String']['input'];
  blogHandle: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type ArticleQuery = {
  blog?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Blog, 'handle' | 'title'> & {
      articleByHandle?: StorefrontAPI.Maybe<
        Pick<
          StorefrontAPI.Article,
          | 'handle'
          | 'title'
          | 'contentHtml'
          | 'content'
          | 'excerpt'
          | 'publishedAt'
        > & {
          author?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.ArticleAuthor, 'name'>
          >;
          image?: StorefrontAPI.Maybe<
            Pick<
              StorefrontAPI.Image,
              'id' | 'altText' | 'url' | 'width' | 'height'
            >
          >;
          seo?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Seo, 'description' | 'title'>
          >;
        }
      >;
    }
  >;
};

export type BlogQueryVariables = StorefrontAPI.Exact<{
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  blogHandle: StorefrontAPI.Scalars['String']['input'];
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
}>;

export type BlogQuery = {
  blog?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Blog, 'title' | 'handle'> & {
      seo?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Seo, 'title' | 'description'>
      >;
      articles: {
        nodes: Array<
          Pick<
            StorefrontAPI.Article,
            'content' | 'excerpt' | 'handle' | 'id' | 'publishedAt' | 'title'
          > & {
            author?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.ArticleAuthor, 'name'>
            >;
            image?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'altText' | 'url' | 'width' | 'height'
              >
            >;
            blog: Pick<StorefrontAPI.Blog, 'handle'>;
          }
        >;
        pageInfo: Pick<
          StorefrontAPI.PageInfo,
          'hasPreviousPage' | 'hasNextPage' | 'endCursor' | 'startCursor'
        >;
      };
    }
  >;
};

export type ArticleItemFragment = Pick<
  StorefrontAPI.Article,
  'content' | 'excerpt' | 'handle' | 'id' | 'publishedAt' | 'title'
> & {
  author?: StorefrontAPI.Maybe<Pick<StorefrontAPI.ArticleAuthor, 'name'>>;
  image?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'altText' | 'url' | 'width' | 'height'>
  >;
  blog: Pick<StorefrontAPI.Blog, 'handle'>;
};

export type BlogsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
}>;

export type BlogsQuery = {
  blogs: {
    pageInfo: Pick<
      StorefrontAPI.PageInfo,
      'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'
    >;
    nodes: Array<
      Pick<StorefrontAPI.Blog, 'title' | 'handle'> & {
        seo?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Seo, 'title' | 'description'>
        >;
      }
    >;
  };
};

export type CollectionQueryVariables = StorefrontAPI.Exact<{
  handle: StorefrontAPI.Scalars['String']['input'];
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  filters?: StorefrontAPI.InputMaybe<
    Array<StorefrontAPI.ProductFilter> | StorefrontAPI.ProductFilter
  >;
  sortKey?: StorefrontAPI.InputMaybe<StorefrontAPI.ProductCollectionSortKeys>;
  reverse?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Boolean']['input']>;
}>;

export type CollectionQuery = {
  collection?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Collection,
      'id' | 'handle' | 'title' | 'description'
    > & {
      image?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
      >;
      seo: Pick<StorefrontAPI.Seo, 'title' | 'description'>;
      products: {
        nodes: Array<
          Pick<
            StorefrontAPI.Product,
            | 'id'
            | 'handle'
            | 'title'
            | 'vendor'
            | 'availableForSale'
            | 'description'
          > & {
            featuredImage?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
            priceRange: {
              minVariantPrice: Pick<
                StorefrontAPI.MoneyV2,
                'amount' | 'currencyCode'
              >;
            };
            compareAtPriceRange: {
              minVariantPrice: Pick<
                StorefrontAPI.MoneyV2,
                'amount' | 'currencyCode'
              >;
            };
            badge?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
            shortDescription?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
            rating?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
            ratingCount?: StorefrontAPI.Maybe<
              Pick<StorefrontAPI.Metafield, 'value'>
            >;
          }
        >;
        filters: Array<
          Pick<
            StorefrontAPI.Filter,
            'id' | 'label' | 'type' | 'presentation'
          > & {
            values: Array<
              Pick<
                StorefrontAPI.FilterValue,
                'id' | 'label' | 'count' | 'input'
              > & {
                swatch?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Swatch, 'color'>
                >;
              }
            >;
          }
        >;
        pageInfo: Pick<
          StorefrontAPI.PageInfo,
          'hasPreviousPage' | 'hasNextPage' | 'endCursor' | 'startCursor'
        >;
      };
    }
  >;
};

export type CollectionFragment = Pick<
  StorefrontAPI.Collection,
  'id' | 'title' | 'handle' | 'description'
> & {
  image?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
  >;
};

export type StoreCollectionsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
}>;

export type StoreCollectionsQuery = {
  collections: {
    nodes: Array<
      Pick<
        StorefrontAPI.Collection,
        'id' | 'title' | 'handle' | 'description'
      > & {
        image?: StorefrontAPI.Maybe<
          Pick<
            StorefrontAPI.Image,
            'id' | 'url' | 'altText' | 'width' | 'height'
          >
        >;
      }
    >;
    pageInfo: Pick<
      StorefrontAPI.PageInfo,
      'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'
    >;
  };
};

export type CatalogQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  sortKey?: StorefrontAPI.InputMaybe<StorefrontAPI.ProductSortKeys>;
  reverse?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Boolean']['input']>;
}>;

export type CatalogQuery = {
  products: {
    nodes: Array<
      Pick<
        StorefrontAPI.Product,
        | 'id'
        | 'handle'
        | 'title'
        | 'vendor'
        | 'availableForSale'
        | 'description'
      > & {
        featuredImage?: StorefrontAPI.Maybe<
          Pick<
            StorefrontAPI.Image,
            'id' | 'url' | 'altText' | 'width' | 'height'
          >
        >;
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        compareAtPriceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        badge?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        shortDescription?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
        rating?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        ratingCount?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
      }
    >;
    pageInfo: Pick<
      StorefrontAPI.PageInfo,
      'hasPreviousPage' | 'hasNextPage' | 'startCursor' | 'endCursor'
    >;
  };
};

export type PageQueryVariables = StorefrontAPI.Exact<{
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  handle: StorefrontAPI.Scalars['String']['input'];
}>;

export type PageQuery = {
  page?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Page,
      'handle' | 'id' | 'title' | 'body' | 'bodySummary'
    > & {
      seo?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Seo, 'description' | 'title'>
      >;
    }
  >;
};

export type AboutPageQueryVariables = StorefrontAPI.Exact<{
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  handle: StorefrontAPI.Scalars['String']['input'];
}>;

export type AboutPageQuery = {
  page?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Page, 'id' | 'handle' | 'title' | 'body'> & {
      seo?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Seo, 'description' | 'title'>
      >;
    }
  >;
};

export type PolicyFragment = Pick<
  StorefrontAPI.ShopPolicy,
  'body' | 'handle' | 'id' | 'title' | 'url'
>;

export type SubscriptionPolicyFragment = Pick<
  StorefrontAPI.ShopPolicyWithDefault,
  'body' | 'handle' | 'id' | 'title' | 'url'
>;

export type PolicyQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  privacyPolicy: StorefrontAPI.Scalars['Boolean']['input'];
  refundPolicy: StorefrontAPI.Scalars['Boolean']['input'];
  shippingPolicy: StorefrontAPI.Scalars['Boolean']['input'];
  subscriptionPolicy: StorefrontAPI.Scalars['Boolean']['input'];
  termsOfService: StorefrontAPI.Scalars['Boolean']['input'];
}>;

export type PolicyQuery = {
  shop: {
    privacyPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'body' | 'handle' | 'id' | 'title' | 'url'>
    >;
    shippingPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'body' | 'handle' | 'id' | 'title' | 'url'>
    >;
    termsOfService?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'body' | 'handle' | 'id' | 'title' | 'url'>
    >;
    refundPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'body' | 'handle' | 'id' | 'title' | 'url'>
    >;
    subscriptionPolicy?: StorefrontAPI.Maybe<
      Pick<
        StorefrontAPI.ShopPolicyWithDefault,
        'body' | 'handle' | 'id' | 'title' | 'url'
      >
    >;
  };
};

export type PolicyItemFragment = Pick<
  StorefrontAPI.ShopPolicy,
  'id' | 'title' | 'handle'
>;

export type PoliciesQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
}>;

export type PoliciesQuery = {
  shop: {
    privacyPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'id' | 'title' | 'handle'>
    >;
    shippingPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'id' | 'title' | 'handle'>
    >;
    termsOfService?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'id' | 'title' | 'handle'>
    >;
    refundPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicy, 'id' | 'title' | 'handle'>
    >;
    subscriptionPolicy?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ShopPolicyWithDefault, 'id' | 'title' | 'handle'>
    >;
  };
};

export type ProductVariantFragment = Pick<
  StorefrontAPI.ProductVariant,
  'availableForSale' | 'id' | 'sku' | 'title'
> & {
  compareAtPrice?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
  >;
  image?: StorefrontAPI.Maybe<
    {__typename: 'Image'} & Pick<
      StorefrontAPI.Image,
      'id' | 'url' | 'altText' | 'width' | 'height'
    >
  >;
  price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
  product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
  selectedOptions: Array<Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>>;
};

export type ProductFragment = Pick<
  StorefrontAPI.Product,
  | 'id'
  | 'title'
  | 'vendor'
  | 'handle'
  | 'descriptionHtml'
  | 'description'
  | 'encodedVariantExistence'
  | 'encodedVariantAvailability'
> & {
  featuredImage?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
  >;
  media: {
    nodes: Array<
      | ({__typename: 'ExternalVideo'} & Pick<
          StorefrontAPI.ExternalVideo,
          'id' | 'alt'
        > & {
            previewImage?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
          })
      | ({__typename: 'MediaImage'} & Pick<
          StorefrontAPI.MediaImage,
          'id' | 'alt'
        > & {
            image?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
            previewImage?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
          })
      | ({__typename: 'Model3d'} & Pick<StorefrontAPI.Model3d, 'id' | 'alt'> & {
            previewImage?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
          })
      | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id' | 'alt'> & {
            previewImage?: StorefrontAPI.Maybe<
              Pick<
                StorefrontAPI.Image,
                'id' | 'url' | 'altText' | 'width' | 'height'
              >
            >;
          })
    >;
  };
  options: Array<
    Pick<StorefrontAPI.ProductOption, 'name'> & {
      optionValues: Array<
        Pick<StorefrontAPI.ProductOptionValue, 'name'> & {
          firstSelectableVariant?: StorefrontAPI.Maybe<
            Pick<
              StorefrontAPI.ProductVariant,
              'availableForSale' | 'id' | 'sku' | 'title'
            > & {
              compareAtPrice?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
              >;
              image?: StorefrontAPI.Maybe<
                {__typename: 'Image'} & Pick<
                  StorefrontAPI.Image,
                  'id' | 'url' | 'altText' | 'width' | 'height'
                >
              >;
              price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
              product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
              selectedOptions: Array<
                Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
              >;
            }
          >;
          swatch?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.ProductOptionValueSwatch, 'color'> & {
              image?: StorefrontAPI.Maybe<{
                previewImage?: StorefrontAPI.Maybe<
                  Pick<StorefrontAPI.Image, 'url'>
                >;
              }>;
            }
          >;
        }
      >;
    }
  >;
  selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.ProductVariant,
      'availableForSale' | 'id' | 'sku' | 'title'
    > & {
      compareAtPrice?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
      >;
      image?: StorefrontAPI.Maybe<
        {__typename: 'Image'} & Pick<
          StorefrontAPI.Image,
          'id' | 'url' | 'altText' | 'width' | 'height'
        >
      >;
      price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
      selectedOptions: Array<
        Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
      >;
    }
  >;
  adjacentVariants: Array<
    Pick<
      StorefrontAPI.ProductVariant,
      'availableForSale' | 'id' | 'sku' | 'title'
    > & {
      compareAtPrice?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
      >;
      image?: StorefrontAPI.Maybe<
        {__typename: 'Image'} & Pick<
          StorefrontAPI.Image,
          'id' | 'url' | 'altText' | 'width' | 'height'
        >
      >;
      price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
      product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
      selectedOptions: Array<
        Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
      >;
    }
  >;
  seo: Pick<StorefrontAPI.Seo, 'description' | 'title'>;
  badge?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value' | 'type'>>;
  shortDescription?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Metafield, 'value' | 'type'>
  >;
  rating?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value' | 'type'>>;
  ratingCount?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Metafield, 'value' | 'type'>
  >;
  features?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Metafield, 'value' | 'type'>
  >;
  materials?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Metafield, 'value' | 'type'>
  >;
  care?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value' | 'type'>>;
  swatchGroups?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Metafield, 'value' | 'type'>
  >;
  savingsNote?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Metafield, 'value' | 'type'>
  >;
  featuredReviews?: StorefrontAPI.Maybe<
    Pick<StorefrontAPI.Metafield, 'value' | 'type'> & {
      references?: StorefrontAPI.Maybe<{
        nodes: Array<
          Pick<StorefrontAPI.Metaobject, 'id' | 'handle'> & {
            fields: Array<Pick<StorefrontAPI.MetaobjectField, 'key' | 'value'>>;
          }
        >;
      }>;
    }
  >;
};

export type ProductQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  handle: StorefrontAPI.Scalars['String']['input'];
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  selectedOptions:
    | Array<StorefrontAPI.SelectedOptionInput>
    | StorefrontAPI.SelectedOptionInput;
}>;

export type ProductQuery = {
  product?: StorefrontAPI.Maybe<
    Pick<
      StorefrontAPI.Product,
      | 'id'
      | 'title'
      | 'vendor'
      | 'handle'
      | 'descriptionHtml'
      | 'description'
      | 'encodedVariantExistence'
      | 'encodedVariantAvailability'
    > & {
      featuredImage?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
      >;
      media: {
        nodes: Array<
          | ({__typename: 'ExternalVideo'} & Pick<
              StorefrontAPI.ExternalVideo,
              'id' | 'alt'
            > & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<
                    StorefrontAPI.Image,
                    'id' | 'url' | 'altText' | 'width' | 'height'
                  >
                >;
              })
          | ({__typename: 'MediaImage'} & Pick<
              StorefrontAPI.MediaImage,
              'id' | 'alt'
            > & {
                image?: StorefrontAPI.Maybe<
                  Pick<
                    StorefrontAPI.Image,
                    'id' | 'url' | 'altText' | 'width' | 'height'
                  >
                >;
                previewImage?: StorefrontAPI.Maybe<
                  Pick<
                    StorefrontAPI.Image,
                    'id' | 'url' | 'altText' | 'width' | 'height'
                  >
                >;
              })
          | ({__typename: 'Model3d'} & Pick<
              StorefrontAPI.Model3d,
              'id' | 'alt'
            > & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<
                    StorefrontAPI.Image,
                    'id' | 'url' | 'altText' | 'width' | 'height'
                  >
                >;
              })
          | ({__typename: 'Video'} & Pick<StorefrontAPI.Video, 'id' | 'alt'> & {
                previewImage?: StorefrontAPI.Maybe<
                  Pick<
                    StorefrontAPI.Image,
                    'id' | 'url' | 'altText' | 'width' | 'height'
                  >
                >;
              })
        >;
      };
      options: Array<
        Pick<StorefrontAPI.ProductOption, 'name'> & {
          optionValues: Array<
            Pick<StorefrontAPI.ProductOptionValue, 'name'> & {
              firstSelectableVariant?: StorefrontAPI.Maybe<
                Pick<
                  StorefrontAPI.ProductVariant,
                  'availableForSale' | 'id' | 'sku' | 'title'
                > & {
                  compareAtPrice?: StorefrontAPI.Maybe<
                    Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
                  >;
                  image?: StorefrontAPI.Maybe<
                    {__typename: 'Image'} & Pick<
                      StorefrontAPI.Image,
                      'id' | 'url' | 'altText' | 'width' | 'height'
                    >
                  >;
                  price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
                  product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
                  selectedOptions: Array<
                    Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
                  >;
                }
              >;
              swatch?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.ProductOptionValueSwatch, 'color'> & {
                  image?: StorefrontAPI.Maybe<{
                    previewImage?: StorefrontAPI.Maybe<
                      Pick<StorefrontAPI.Image, 'url'>
                    >;
                  }>;
                }
              >;
            }
          >;
        }
      >;
      selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
        Pick<
          StorefrontAPI.ProductVariant,
          'availableForSale' | 'id' | 'sku' | 'title'
        > & {
          compareAtPrice?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
          >;
          image?: StorefrontAPI.Maybe<
            {__typename: 'Image'} & Pick<
              StorefrontAPI.Image,
              'id' | 'url' | 'altText' | 'width' | 'height'
            >
          >;
          price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
          product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
          selectedOptions: Array<
            Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
          >;
        }
      >;
      adjacentVariants: Array<
        Pick<
          StorefrontAPI.ProductVariant,
          'availableForSale' | 'id' | 'sku' | 'title'
        > & {
          compareAtPrice?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
          >;
          image?: StorefrontAPI.Maybe<
            {__typename: 'Image'} & Pick<
              StorefrontAPI.Image,
              'id' | 'url' | 'altText' | 'width' | 'height'
            >
          >;
          price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
          product: Pick<StorefrontAPI.Product, 'title' | 'handle'>;
          selectedOptions: Array<
            Pick<StorefrontAPI.SelectedOption, 'name' | 'value'>
          >;
        }
      >;
      seo: Pick<StorefrontAPI.Seo, 'description' | 'title'>;
      badge?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'>
      >;
      shortDescription?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'>
      >;
      rating?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'>
      >;
      ratingCount?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'>
      >;
      features?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'>
      >;
      materials?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'>
      >;
      care?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'>
      >;
      swatchGroups?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'>
      >;
      savingsNote?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'>
      >;
      featuredReviews?: StorefrontAPI.Maybe<
        Pick<StorefrontAPI.Metafield, 'value' | 'type'> & {
          references?: StorefrontAPI.Maybe<{
            nodes: Array<
              Pick<StorefrontAPI.Metaobject, 'id' | 'handle'> & {
                fields: Array<
                  Pick<StorefrontAPI.MetaobjectField, 'key' | 'value'>
                >;
              }
            >;
          }>;
        }
      >;
    }
  >;
};

export type ProductRecommendationsQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  productId: StorefrontAPI.Scalars['ID']['input'];
}>;

export type ProductRecommendationsQuery = {
  productRecommendations?: StorefrontAPI.Maybe<
    Array<
      Pick<
        StorefrontAPI.Product,
        | 'id'
        | 'handle'
        | 'title'
        | 'vendor'
        | 'availableForSale'
        | 'description'
      > & {
        featuredImage?: StorefrontAPI.Maybe<
          Pick<
            StorefrontAPI.Image,
            'id' | 'url' | 'altText' | 'width' | 'height'
          >
        >;
        priceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        compareAtPriceRange: {
          minVariantPrice: Pick<
            StorefrontAPI.MoneyV2,
            'amount' | 'currencyCode'
          >;
        };
        badge?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        shortDescription?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
        rating?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
        ratingCount?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Metafield, 'value'>
        >;
      }
    >
  >;
};

export type SearchProductFragment = {__typename: 'Product'} & Pick<
  StorefrontAPI.Product,
  | 'publishedAt'
  | 'trackingParameters'
  | 'id'
  | 'handle'
  | 'title'
  | 'vendor'
  | 'availableForSale'
  | 'description'
> & {
    featuredImage?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'id' | 'url' | 'altText' | 'width' | 'height'>
    >;
    priceRange: {
      minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
    };
    compareAtPriceRange: {
      minVariantPrice: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
    };
    badge?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    shortDescription?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Metafield, 'value'>
    >;
    rating?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
    ratingCount?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
  };

export type SearchPageFragment = {__typename: 'Page'} & Pick<
  StorefrontAPI.Page,
  'handle' | 'id' | 'title' | 'trackingParameters'
>;

export type SearchArticleFragment = {__typename: 'Article'} & Pick<
  StorefrontAPI.Article,
  'handle' | 'id' | 'title' | 'trackingParameters'
> & {blog: Pick<StorefrontAPI.Blog, 'handle'>};

export type PageInfoFragmentFragment = Pick<
  StorefrontAPI.PageInfo,
  'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'
>;

export type RegularSearchQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  endCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
  first?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  last?: StorefrontAPI.InputMaybe<StorefrontAPI.Scalars['Int']['input']>;
  term: StorefrontAPI.Scalars['String']['input'];
  startCursor?: StorefrontAPI.InputMaybe<
    StorefrontAPI.Scalars['String']['input']
  >;
}>;

export type RegularSearchQuery = {
  articles: {
    nodes: Array<
      {__typename: 'Article'} & Pick<
        StorefrontAPI.Article,
        'handle' | 'id' | 'title' | 'trackingParameters'
      > & {blog: Pick<StorefrontAPI.Blog, 'handle'>}
    >;
  };
  pages: {
    nodes: Array<
      {__typename: 'Page'} & Pick<
        StorefrontAPI.Page,
        'handle' | 'id' | 'title' | 'trackingParameters'
      >
    >;
  };
  products: Pick<StorefrontAPI.SearchResultItemConnection, 'totalCount'> & {
    nodes: Array<
      {__typename: 'Product'} & Pick<
        StorefrontAPI.Product,
        | 'publishedAt'
        | 'trackingParameters'
        | 'id'
        | 'handle'
        | 'title'
        | 'vendor'
        | 'availableForSale'
        | 'description'
      > & {
          featuredImage?: StorefrontAPI.Maybe<
            Pick<
              StorefrontAPI.Image,
              'id' | 'url' | 'altText' | 'width' | 'height'
            >
          >;
          priceRange: {
            minVariantPrice: Pick<
              StorefrontAPI.MoneyV2,
              'amount' | 'currencyCode'
            >;
          };
          compareAtPriceRange: {
            minVariantPrice: Pick<
              StorefrontAPI.MoneyV2,
              'amount' | 'currencyCode'
            >;
          };
          badge?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
          shortDescription?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Metafield, 'value'>
          >;
          rating?: StorefrontAPI.Maybe<Pick<StorefrontAPI.Metafield, 'value'>>;
          ratingCount?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Metafield, 'value'>
          >;
        }
    >;
    pageInfo: Pick<
      StorefrontAPI.PageInfo,
      'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'
    >;
  };
};

export type PredictiveArticleFragment = {__typename: 'Article'} & Pick<
  StorefrontAPI.Article,
  'id' | 'title' | 'handle' | 'trackingParameters'
> & {
    blog: Pick<StorefrontAPI.Blog, 'handle'>;
    image?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
    >;
  };

export type PredictiveCollectionFragment = {__typename: 'Collection'} & Pick<
  StorefrontAPI.Collection,
  'id' | 'title' | 'handle' | 'trackingParameters'
> & {
    image?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
    >;
  };

export type PredictivePageFragment = {__typename: 'Page'} & Pick<
  StorefrontAPI.Page,
  'id' | 'title' | 'handle' | 'trackingParameters'
>;

export type PredictiveProductFragment = {__typename: 'Product'} & Pick<
  StorefrontAPI.Product,
  'id' | 'title' | 'handle' | 'trackingParameters'
> & {
    selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
      Pick<StorefrontAPI.ProductVariant, 'id'> & {
        image?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
        >;
        price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
        compareAtPrice?: StorefrontAPI.Maybe<
          Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
        >;
      }
    >;
  };

export type PredictiveQueryFragment = {
  __typename: 'SearchQuerySuggestion';
} & Pick<StorefrontAPI.SearchQuerySuggestion, 'text' | 'trackingParameters'>;

export type PredictiveSearchQueryVariables = StorefrontAPI.Exact<{
  country?: StorefrontAPI.InputMaybe<StorefrontAPI.CountryCode>;
  language?: StorefrontAPI.InputMaybe<StorefrontAPI.LanguageCode>;
  limit: StorefrontAPI.Scalars['Int']['input'];
  limitScope: StorefrontAPI.PredictiveSearchLimitScope;
  term: StorefrontAPI.Scalars['String']['input'];
  types?: StorefrontAPI.InputMaybe<
    | Array<StorefrontAPI.PredictiveSearchType>
    | StorefrontAPI.PredictiveSearchType
  >;
}>;

export type PredictiveSearchQuery = {
  predictiveSearch?: StorefrontAPI.Maybe<{
    articles: Array<
      {__typename: 'Article'} & Pick<
        StorefrontAPI.Article,
        'id' | 'title' | 'handle' | 'trackingParameters'
      > & {
          blog: Pick<StorefrontAPI.Blog, 'handle'>;
          image?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
          >;
        }
    >;
    collections: Array<
      {__typename: 'Collection'} & Pick<
        StorefrontAPI.Collection,
        'id' | 'title' | 'handle' | 'trackingParameters'
      > & {
          image?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.Image, 'url' | 'altText' | 'width' | 'height'>
          >;
        }
    >;
    pages: Array<
      {__typename: 'Page'} & Pick<
        StorefrontAPI.Page,
        'id' | 'title' | 'handle' | 'trackingParameters'
      >
    >;
    products: Array<
      {__typename: 'Product'} & Pick<
        StorefrontAPI.Product,
        'id' | 'title' | 'handle' | 'trackingParameters'
      > & {
          selectedOrFirstAvailableVariant?: StorefrontAPI.Maybe<
            Pick<StorefrontAPI.ProductVariant, 'id'> & {
              image?: StorefrontAPI.Maybe<
                Pick<
                  StorefrontAPI.Image,
                  'url' | 'altText' | 'width' | 'height'
                >
              >;
              price: Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>;
              compareAtPrice?: StorefrontAPI.Maybe<
                Pick<StorefrontAPI.MoneyV2, 'amount' | 'currencyCode'>
              >;
            }
          >;
        }
    >;
    queries: Array<
      {__typename: 'SearchQuerySuggestion'} & Pick<
        StorefrontAPI.SearchQuerySuggestion,
        'text' | 'trackingParameters'
      >
    >;
  }>;
};

interface GeneratedQueryTypes {
  '#graphql\n  query ShopData(\n    $country: CountryCode\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    shop {\n      id\n    }\n    localization {\n      country {\n        currency {\n          isoCode\n        }\n      }\n      language {\n        isoCode\n      }\n    }\n  }\n': {
    return: ShopDataQuery;
    variables: ShopDataQueryVariables;
  };
  '#graphql\n  query CartQuery(\n    $cartId: ID!\n    $numCartLines: Int = 100\n    $country: CountryCode = ZZ\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    cart(id: $cartId) {\n      ...CartApiQuery\n    }\n  }\n  #graphql\n  fragment Money on MoneyV2 {\n    currencyCode\n    amount\n  }\n  fragment CartLine on CartLine {\n    id\n    quantity\n    attributes {\n      key\n      value\n    }\n    cost {\n      totalAmount {\n        ...Money\n      }\n      amountPerQuantity {\n        ...Money\n      }\n      compareAtAmountPerQuantity {\n        ...Money\n      }\n    }\n    merchandise {\n      ... on ProductVariant {\n        id\n        availableForSale\n        compareAtPrice {\n          ...Money\n        }\n        price {\n          ...Money\n        }\n        requiresShipping\n        title\n        image {\n          id\n          url\n          altText\n          width\n          height\n\n        }\n        product {\n          handle\n          title\n          id\n          vendor\n        }\n        selectedOptions {\n          name\n          value\n        }\n      }\n    }\n    parentRelationship {\n      parent {\n        id\n      }\n    }\n  }\n  fragment CartLineComponent on ComponentizableCartLine {\n    id\n    quantity\n    attributes {\n      key\n      value\n    }\n    cost {\n      totalAmount {\n        ...Money\n      }\n      amountPerQuantity {\n        ...Money\n      }\n      compareAtAmountPerQuantity {\n        ...Money\n      }\n    }\n    merchandise {\n      ... on ProductVariant {\n        id\n        availableForSale\n        compareAtPrice {\n          ...Money\n        }\n        price {\n          ...Money\n        }\n        requiresShipping\n        title\n        image {\n          id\n          url\n          altText\n          width\n          height\n        }\n        product {\n          handle\n          title\n          id\n          vendor\n        }\n        selectedOptions {\n          name\n          value\n        }\n      }\n    }\n    lineComponents {\n      ...CartLine\n    }\n  }\n  fragment CartApiQuery on Cart {\n    updatedAt\n    id\n    appliedGiftCards {\n      id\n      lastCharacters\n      amountUsed {\n        ...Money\n      }\n    }\n    checkoutUrl\n    totalQuantity\n    buyerIdentity {\n      countryCode\n      customer {\n        id\n        email\n        firstName\n        lastName\n        displayName\n      }\n      email\n      phone\n    }\n    lines(first: $numCartLines) {\n      nodes {\n        ...CartLine\n      }\n      nodes {\n        ...CartLineComponent\n      }\n    }\n    cost {\n      subtotalAmount {\n        ...Money\n      }\n      totalAmount {\n        ...Money\n      }\n      totalDutyAmount {\n        ...Money\n      }\n      totalTaxAmount {\n        ...Money\n      }\n    }\n    note\n    attributes {\n      key\n      value\n    }\n    discountCodes {\n      code\n      applicable\n    }\n    discountAllocations {\n      discountedAmount {\n        ...Money\n      }\n    }\n  }\n\n': {
    return: CartQueryQuery;
    variables: CartQueryQueryVariables;
  };
  '#graphql\n  query HomeContent($country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    settings: metaobjects(type: "mellow_settings", first: 1) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n    hero: metaobjects(type: "mellow_hero", first: 1) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n    pressLogos: metaobjects(type: "mellow_press_logo", first: 12) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n    story: metaobjects(type: "mellow_story", first: 1) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n    ugcVideos: metaobjects(type: "mellow_ugc_video", first: 8) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n    lifestyle: metaobjects(type: "mellow_lifestyle_image", first: 4) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n    testimonials: metaobjects(type: "mellow_testimonial", first: 9) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n    faqs: metaobjects(type: "mellow_faq", first: 12) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n  }\n  #graphql\n  fragment MellowMetaobject on Metaobject {\n    id\n    handle\n    type\n    fields {\n      key\n      type\n      value\n      reference {\n        ...MellowReference\n      }\n    }\n  }\n  #graphql\n  fragment MellowReference on MetafieldReference {\n    __typename\n    ... on MediaImage {\n      id\n      image {\n        url\n        altText\n        width\n        height\n      }\n    }\n    ... on Video {\n      id\n      sources {\n        url\n        mimeType\n      }\n      previewImage {\n        url\n        altText\n        width\n        height\n      }\n    }\n    ... on GenericFile {\n      id\n      url\n      mimeType\n    }\n    ... on Product {\n      id\n      handle\n      title\n    }\n    ... on Collection {\n      id\n      handle\n      title\n    }\n    ... on Page {\n      id\n      handle\n      title\n    }\n    ... on Metaobject {\n      id\n      handle\n      type\n      fields {\n        key\n        type\n        value\n        reference {\n          ... on MediaImage {\n            id\n            image {\n              url\n              altText\n              width\n              height\n            }\n          }\n          ... on Video {\n            id\n            sources {\n              url\n              mimeType\n            }\n            previewImage {\n              url\n              altText\n              width\n              height\n            }\n          }\n          ... on Product {\n            id\n            handle\n            title\n          }\n        }\n      }\n    }\n  }\n\n\n': {
    return: HomeContentQuery;
    variables: HomeContentQueryVariables;
  };
  '#graphql\n  query SiteSettings($country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    settings: metaobjects(type: "mellow_settings", first: 1) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n  }\n  #graphql\n  fragment MellowMetaobject on Metaobject {\n    id\n    handle\n    type\n    fields {\n      key\n      type\n      value\n      reference {\n        ...MellowReference\n      }\n    }\n  }\n  #graphql\n  fragment MellowReference on MetafieldReference {\n    __typename\n    ... on MediaImage {\n      id\n      image {\n        url\n        altText\n        width\n        height\n      }\n    }\n    ... on Video {\n      id\n      sources {\n        url\n        mimeType\n      }\n      previewImage {\n        url\n        altText\n        width\n        height\n      }\n    }\n    ... on GenericFile {\n      id\n      url\n      mimeType\n    }\n    ... on Product {\n      id\n      handle\n      title\n    }\n    ... on Collection {\n      id\n      handle\n      title\n    }\n    ... on Page {\n      id\n      handle\n      title\n    }\n    ... on Metaobject {\n      id\n      handle\n      type\n      fields {\n        key\n        type\n        value\n        reference {\n          ... on MediaImage {\n            id\n            image {\n              url\n              altText\n              width\n              height\n            }\n          }\n          ... on Video {\n            id\n            sources {\n              url\n              mimeType\n            }\n            previewImage {\n              url\n              altText\n              width\n              height\n            }\n          }\n          ... on Product {\n            id\n            handle\n            title\n          }\n        }\n      }\n    }\n  }\n\n\n': {
    return: SiteSettingsQuery;
    variables: SiteSettingsQueryVariables;
  };
  '#graphql\n  query AboutContent($country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    about: metaobjects(type: "mellow_about", first: 1) {\n      nodes {\n        ...MellowMetaobject\n      }\n    }\n  }\n  #graphql\n  fragment MellowMetaobject on Metaobject {\n    id\n    handle\n    type\n    fields {\n      key\n      type\n      value\n      reference {\n        ...MellowReference\n      }\n    }\n  }\n  #graphql\n  fragment MellowReference on MetafieldReference {\n    __typename\n    ... on MediaImage {\n      id\n      image {\n        url\n        altText\n        width\n        height\n      }\n    }\n    ... on Video {\n      id\n      sources {\n        url\n        mimeType\n      }\n      previewImage {\n        url\n        altText\n        width\n        height\n      }\n    }\n    ... on GenericFile {\n      id\n      url\n      mimeType\n    }\n    ... on Product {\n      id\n      handle\n      title\n    }\n    ... on Collection {\n      id\n      handle\n      title\n    }\n    ... on Page {\n      id\n      handle\n      title\n    }\n    ... on Metaobject {\n      id\n      handle\n      type\n      fields {\n        key\n        type\n        value\n        reference {\n          ... on MediaImage {\n            id\n            image {\n              url\n              altText\n              width\n              height\n            }\n          }\n          ... on Video {\n            id\n            sources {\n              url\n              mimeType\n            }\n            previewImage {\n              url\n              altText\n              width\n              height\n            }\n          }\n          ... on Product {\n            id\n            handle\n            title\n          }\n        }\n      }\n    }\n  }\n\n\n': {
    return: AboutContentQuery;
    variables: AboutContentQueryVariables;
  };
  '#graphql\n  fragment Shop on Shop {\n    id\n    name\n    description\n    primaryDomain {\n      url\n    }\n    brand {\n      logo {\n        image {\n          url\n        }\n      }\n    }\n  }\n  query Header(\n    $country: CountryCode\n    $headerMenuHandle: String!\n    $language: LanguageCode\n  ) @inContext(language: $language, country: $country) {\n    shop {\n      ...Shop\n    }\n    menu(handle: $headerMenuHandle) {\n      ...Menu\n    }\n  }\n  #graphql\n  fragment MenuItem on MenuItem {\n    id\n    resourceId\n    tags\n    title\n    type\n    url\n  }\n  fragment ChildMenuItem on MenuItem {\n    ...MenuItem\n  }\n  fragment ParentMenuItem on MenuItem {\n    ...MenuItem\n    items {\n      ...ChildMenuItem\n    }\n  }\n  fragment Menu on Menu {\n    id\n    items {\n      ...ParentMenuItem\n    }\n  }\n\n': {
    return: HeaderQuery;
    variables: HeaderQueryVariables;
  };
  '#graphql\n  query Footer(\n    $country: CountryCode\n    $footerMenuHandle: String!\n    $language: LanguageCode\n  ) @inContext(language: $language, country: $country) {\n    menu(handle: $footerMenuHandle) {\n      ...Menu\n    }\n  }\n  #graphql\n  fragment MenuItem on MenuItem {\n    id\n    resourceId\n    tags\n    title\n    type\n    url\n  }\n  fragment ChildMenuItem on MenuItem {\n    ...MenuItem\n  }\n  fragment ParentMenuItem on MenuItem {\n    ...MenuItem\n    items {\n      ...ChildMenuItem\n    }\n  }\n  fragment Menu on Menu {\n    id\n    items {\n      ...ParentMenuItem\n    }\n  }\n\n': {
    return: FooterQuery;
    variables: FooterQueryVariables;
  };
  '#graphql\n    query SitemapProducts($page: Int!) {\n      sitemap(type: PRODUCT) {\n        resources(page: $page) {\n          items {\n            handle\n            updatedAt\n          }\n        }\n      }\n    }\n': {
    return: SitemapProductsQuery;
    variables: SitemapProductsQueryVariables;
  };
  '#graphql\n    query SitemapCollections($page: Int!) {\n      sitemap(type: COLLECTION) {\n        resources(page: $page) {\n          items {\n            handle\n            updatedAt\n          }\n        }\n      }\n    }\n': {
    return: SitemapCollectionsQuery;
    variables: SitemapCollectionsQueryVariables;
  };
  '#graphql\n    query SitemapArticles($page: Int!) {\n      sitemap(type: ARTICLE) {\n        resources(page: $page) {\n          items {\n            handle\n            updatedAt\n          }\n        }\n      }\n    }\n': {
    return: SitemapArticlesQuery;
    variables: SitemapArticlesQueryVariables;
  };
  '#graphql\n    query SitemapPages($page: Int!) {\n      sitemap(type: PAGE) {\n        resources(page: $page) {\n          items {\n            handle\n            updatedAt\n          }\n        }\n      }\n    }\n': {
    return: SitemapPagesQuery;
    variables: SitemapPagesQueryVariables;
  };
  '#graphql\n    query SitemapBlogs($page: Int!) {\n      sitemap(type: BLOG) {\n        resources(page: $page) {\n          items {\n            handle\n            updatedAt\n          }\n        }\n      }\n    }\n': {
    return: SitemapBlogsQuery;
    variables: SitemapBlogsQueryVariables;
  };
  '#graphql\n    query SitemapMetaobjects($page: Int!) {\n      sitemap(type: METAOBJECT) {\n        resources(page: $page) {\n          items {\n            handle\n            updatedAt\n            ... on SitemapResourceMetaobject {\n              type\n            }\n          }\n        }\n      }\n    }\n': {
    return: SitemapMetaobjectsQuery;
    variables: SitemapMetaobjectsQueryVariables;
  };
  '#graphql\nquery SitemapIndex {\n  products: sitemap(type: PRODUCT) {\n    pagesCount {\n      count\n    }\n  }\n  collections: sitemap(type: COLLECTION) {\n    pagesCount {\n      count\n    }\n  }\n  articles: sitemap(type: ARTICLE) {\n    pagesCount {\n      count\n    }\n  }\n  pages: sitemap(type: PAGE) {\n    pagesCount {\n      count\n    }\n  }\n  blogs: sitemap(type: BLOG) {\n    pagesCount {\n      count\n    }\n  }\n  metaObjects: sitemap(type: METAOBJECT) {\n    pagesCount {\n      count\n    }\n  }\n}\n': {
    return: SitemapIndexQuery;
    variables: SitemapIndexQueryVariables;
  };
  '#graphql\n  query redirects($query: String) {\n    urlRedirects(first: 1, query: $query) {\n      edges {\n        node {\n          target\n        }\n      }\n    }\n  }\n': {
    return: RedirectsQuery;
    variables: RedirectsQueryVariables;
  };
  '#graphql\n  query Homepage(\n    $country: CountryCode\n    $language: LanguageCode\n    $featuredHandle: String!\n    $first: Int!\n  ) @inContext(country: $country, language: $language) {\n    featured: collection(handle: $featuredHandle) {\n      id\n      handle\n      title\n      products(first: $first) {\n        nodes {\n          ...ProductCard\n        }\n      }\n    }\n    bestSellers: products(first: $first, sortKey: BEST_SELLING) {\n      nodes {\n        ...ProductCard\n      }\n    }\n  }\n  #graphql\n  fragment MoneyProductCard on MoneyV2 {\n    amount\n    currencyCode\n  }\n  fragment ProductCard on Product {\n    id\n    handle\n    title\n    vendor\n    availableForSale\n    description(truncateAt: 200)\n    featuredImage {\n      id\n      url\n      altText\n      width\n      height\n    }\n    priceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    badge: metafield(namespace: "mellow", key: "badge") {\n      value\n    }\n    shortDescription: metafield(namespace: "mellow", key: "short_description") {\n      value\n    }\n    rating: metafield(namespace: "reviews", key: "rating") {\n      value\n    }\n    ratingCount: metafield(namespace: "reviews", key: "rating_count") {\n      value\n    }\n  }\n\n': {
    return: HomepageQuery;
    variables: HomepageQueryVariables;
  };
  '#graphql\n  query Article(\n    $articleHandle: String!\n    $blogHandle: String!\n    $country: CountryCode\n    $language: LanguageCode\n  ) @inContext(language: $language, country: $country) {\n    blog(handle: $blogHandle) {\n      handle\n      title\n      articleByHandle(handle: $articleHandle) {\n        handle\n        title\n        contentHtml\n        content(truncateAt: 160)\n        excerpt(truncateAt: 160)\n        publishedAt\n        author: authorV2 {\n          name\n        }\n        image {\n          id\n          altText\n          url\n          width\n          height\n        }\n        seo {\n          description\n          title\n        }\n      }\n    }\n  }\n': {
    return: ArticleQuery;
    variables: ArticleQueryVariables;
  };
  '#graphql\n  query Blog(\n    $language: LanguageCode\n    $blogHandle: String!\n    $first: Int\n    $last: Int\n    $startCursor: String\n    $endCursor: String\n  ) @inContext(language: $language) {\n    blog(handle: $blogHandle) {\n      title\n      handle\n      seo {\n        title\n        description\n      }\n      articles(\n        first: $first,\n        last: $last,\n        before: $startCursor,\n        after: $endCursor\n      ) {\n        nodes {\n          ...ArticleItem\n        }\n        pageInfo {\n          hasPreviousPage\n          hasNextPage\n          endCursor\n          startCursor\n        }\n      }\n    }\n  }\n  fragment ArticleItem on Article {\n    author: authorV2 {\n      name\n    }\n    content(truncateAt: 160)\n    excerpt(truncateAt: 160)\n    handle\n    id\n    image {\n      id\n      altText\n      url\n      width\n      height\n    }\n    publishedAt\n    title\n    blog {\n      handle\n    }\n  }\n': {
    return: BlogQuery;
    variables: BlogQueryVariables;
  };
  '#graphql\n  query Blogs(\n    $country: CountryCode\n    $endCursor: String\n    $first: Int\n    $language: LanguageCode\n    $last: Int\n    $startCursor: String\n  ) @inContext(country: $country, language: $language) {\n    blogs(\n      first: $first,\n      last: $last,\n      before: $startCursor,\n      after: $endCursor\n    ) {\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      nodes {\n        title\n        handle\n        seo {\n          title\n          description\n        }\n      }\n    }\n  }\n': {
    return: BlogsQuery;
    variables: BlogsQueryVariables;
  };
  '#graphql\n  query Collection(\n    $handle: String!\n    $country: CountryCode\n    $language: LanguageCode\n    $first: Int\n    $last: Int\n    $startCursor: String\n    $endCursor: String\n    $filters: [ProductFilter!]\n    $sortKey: ProductCollectionSortKeys\n    $reverse: Boolean\n  ) @inContext(country: $country, language: $language) {\n    collection(handle: $handle) {\n      id\n      handle\n      title\n      description\n      image {\n        id\n        url\n        altText\n        width\n        height\n      }\n      seo {\n        title\n        description\n      }\n      products(\n        first: $first,\n        last: $last,\n        before: $startCursor,\n        after: $endCursor,\n        filters: $filters,\n        sortKey: $sortKey,\n        reverse: $reverse\n      ) {\n        nodes {\n          ...ProductCard\n        }\n        filters {\n          ...CollectionFilter\n        }\n        pageInfo {\n          hasPreviousPage\n          hasNextPage\n          endCursor\n          startCursor\n        }\n      }\n    }\n  }\n  #graphql\n  fragment MoneyProductCard on MoneyV2 {\n    amount\n    currencyCode\n  }\n  fragment ProductCard on Product {\n    id\n    handle\n    title\n    vendor\n    availableForSale\n    description(truncateAt: 200)\n    featuredImage {\n      id\n      url\n      altText\n      width\n      height\n    }\n    priceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    badge: metafield(namespace: "mellow", key: "badge") {\n      value\n    }\n    shortDescription: metafield(namespace: "mellow", key: "short_description") {\n      value\n    }\n    rating: metafield(namespace: "reviews", key: "rating") {\n      value\n    }\n    ratingCount: metafield(namespace: "reviews", key: "rating_count") {\n      value\n    }\n  }\n\n  #graphql\n  fragment CollectionFilter on Filter {\n    id\n    label\n    type\n    presentation\n    values {\n      id\n      label\n      count\n      input\n      swatch {\n        color\n      }\n    }\n  }\n\n': {
    return: CollectionQuery;
    variables: CollectionQueryVariables;
  };
  '#graphql\n  fragment Collection on Collection {\n    id\n    title\n    handle\n    description\n    image {\n      id\n      url\n      altText\n      width\n      height\n    }\n  }\n  query StoreCollections(\n    $country: CountryCode\n    $endCursor: String\n    $first: Int\n    $language: LanguageCode\n    $last: Int\n    $startCursor: String\n  ) @inContext(country: $country, language: $language) {\n    collections(\n      first: $first,\n      last: $last,\n      before: $startCursor,\n      after: $endCursor\n    ) {\n      nodes {\n        ...Collection\n      }\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n': {
    return: StoreCollectionsQuery;
    variables: StoreCollectionsQueryVariables;
  };
  '#graphql\n  query Catalog(\n    $country: CountryCode\n    $language: LanguageCode\n    $first: Int\n    $last: Int\n    $startCursor: String\n    $endCursor: String\n    $sortKey: ProductSortKeys\n    $reverse: Boolean\n  ) @inContext(country: $country, language: $language) {\n    products(\n      first: $first,\n      last: $last,\n      before: $startCursor,\n      after: $endCursor,\n      sortKey: $sortKey,\n      reverse: $reverse\n    ) {\n      nodes {\n        ...ProductCard\n      }\n      pageInfo {\n        hasPreviousPage\n        hasNextPage\n        startCursor\n        endCursor\n      }\n    }\n  }\n  #graphql\n  fragment MoneyProductCard on MoneyV2 {\n    amount\n    currencyCode\n  }\n  fragment ProductCard on Product {\n    id\n    handle\n    title\n    vendor\n    availableForSale\n    description(truncateAt: 200)\n    featuredImage {\n      id\n      url\n      altText\n      width\n      height\n    }\n    priceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    badge: metafield(namespace: "mellow", key: "badge") {\n      value\n    }\n    shortDescription: metafield(namespace: "mellow", key: "short_description") {\n      value\n    }\n    rating: metafield(namespace: "reviews", key: "rating") {\n      value\n    }\n    ratingCount: metafield(namespace: "reviews", key: "rating_count") {\n      value\n    }\n  }\n\n': {
    return: CatalogQuery;
    variables: CatalogQueryVariables;
  };
  '#graphql\n  query Page(\n    $language: LanguageCode,\n    $country: CountryCode,\n    $handle: String!\n  )\n  @inContext(language: $language, country: $country) {\n    page(handle: $handle) {\n      handle\n      id\n      title\n      body\n      bodySummary\n      seo {\n        description\n        title\n      }\n    }\n  }\n': {
    return: PageQuery;
    variables: PageQueryVariables;
  };
  '#graphql\n  query AboutPage(\n    $language: LanguageCode\n    $country: CountryCode\n    $handle: String!\n  ) @inContext(language: $language, country: $country) {\n    page(handle: $handle) {\n      id\n      handle\n      title\n      body\n      seo {\n        description\n        title\n      }\n    }\n  }\n': {
    return: AboutPageQuery;
    variables: AboutPageQueryVariables;
  };
  '#graphql\n  fragment Policy on ShopPolicy {\n    body\n    handle\n    id\n    title\n    url\n  }\n  fragment SubscriptionPolicy on ShopPolicyWithDefault {\n    body\n    handle\n    id\n    title\n    url\n  }\n  query Policy(\n    $country: CountryCode\n    $language: LanguageCode\n    $privacyPolicy: Boolean!\n    $refundPolicy: Boolean!\n    $shippingPolicy: Boolean!\n    $subscriptionPolicy: Boolean!\n    $termsOfService: Boolean!\n  ) @inContext(language: $language, country: $country) {\n    shop {\n      privacyPolicy @include(if: $privacyPolicy) {\n        ...Policy\n      }\n      shippingPolicy @include(if: $shippingPolicy) {\n        ...Policy\n      }\n      termsOfService @include(if: $termsOfService) {\n        ...Policy\n      }\n      refundPolicy @include(if: $refundPolicy) {\n        ...Policy\n      }\n      subscriptionPolicy @include(if: $subscriptionPolicy) {\n        ...SubscriptionPolicy\n      }\n    }\n  }\n': {
    return: PolicyQuery;
    variables: PolicyQueryVariables;
  };
  '#graphql\n  fragment PolicyItem on ShopPolicy {\n    id\n    title\n    handle\n  }\n  query Policies ($country: CountryCode, $language: LanguageCode)\n    @inContext(country: $country, language: $language) {\n    shop {\n      privacyPolicy {\n        ...PolicyItem\n      }\n      shippingPolicy {\n        ...PolicyItem\n      }\n      termsOfService {\n        ...PolicyItem\n      }\n      refundPolicy {\n        ...PolicyItem\n      }\n      subscriptionPolicy {\n        id\n        title\n        handle\n      }\n    }\n  }\n': {
    return: PoliciesQuery;
    variables: PoliciesQueryVariables;
  };
  '#graphql\n  query Product(\n    $country: CountryCode\n    $handle: String!\n    $language: LanguageCode\n    $selectedOptions: [SelectedOptionInput!]!\n  ) @inContext(country: $country, language: $language) {\n    product(handle: $handle) {\n      ...Product\n    }\n  }\n  #graphql\n  fragment Product on Product {\n    id\n    title\n    vendor\n    handle\n    descriptionHtml\n    description\n    encodedVariantExistence\n    encodedVariantAvailability\n    featuredImage {\n      id\n      url\n      altText\n      width\n      height\n    }\n    media(first: 20) {\n      nodes {\n        __typename\n        id\n        alt\n        previewImage {\n          id\n          url\n          altText\n          width\n          height\n        }\n        ... on MediaImage {\n          image {\n            id\n            url\n            altText\n            width\n            height\n          }\n        }\n      }\n    }\n    options {\n      name\n      optionValues {\n        name\n        firstSelectableVariant {\n          ...ProductVariant\n        }\n        swatch {\n          color\n          image {\n            previewImage {\n              url\n            }\n          }\n        }\n      }\n    }\n    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {\n      ...ProductVariant\n    }\n    adjacentVariants (selectedOptions: $selectedOptions) {\n      ...ProductVariant\n    }\n    seo {\n      description\n      title\n    }\n    badge: metafield(namespace: "mellow", key: "badge") {\n      value\n      type\n    }\n    shortDescription: metafield(namespace: "mellow", key: "short_description") {\n      value\n      type\n    }\n    rating: metafield(namespace: "reviews", key: "rating") {\n      value\n      type\n    }\n    ratingCount: metafield(namespace: "reviews", key: "rating_count") {\n      value\n      type\n    }\n    features: metafield(namespace: "mellow", key: "features") {\n      value\n      type\n    }\n    materials: metafield(namespace: "mellow", key: "materials") {\n      value\n      type\n    }\n    care: metafield(namespace: "mellow", key: "care") {\n      value\n      type\n    }\n    swatchGroups: metafield(namespace: "mellow", key: "swatch_groups") {\n      value\n      type\n    }\n    savingsNote: metafield(namespace: "mellow", key: "savings_note") {\n      value\n      type\n    }\n    featuredReviews: metafield(namespace: "mellow", key: "featured_reviews") {\n      value\n      type\n      references(first: 10) {\n        nodes {\n          ... on Metaobject {\n            id\n            handle\n            fields {\n              key\n              value\n            }\n          }\n        }\n      }\n    }\n  }\n  #graphql\n  fragment ProductVariant on ProductVariant {\n    availableForSale\n    compareAtPrice {\n      amount\n      currencyCode\n    }\n    id\n    image {\n      __typename\n      id\n      url\n      altText\n      width\n      height\n    }\n    price {\n      amount\n      currencyCode\n    }\n    product {\n      title\n      handle\n    }\n    selectedOptions {\n      name\n      value\n    }\n    sku\n    title\n  }\n\n\n': {
    return: ProductQuery;
    variables: ProductQueryVariables;
  };
  '#graphql\n  query ProductRecommendations(\n    $country: CountryCode\n    $language: LanguageCode\n    $productId: ID!\n  ) @inContext(country: $country, language: $language) {\n    productRecommendations(productId: $productId, intent: RELATED) {\n      ...ProductCard\n    }\n  }\n  #graphql\n  fragment MoneyProductCard on MoneyV2 {\n    amount\n    currencyCode\n  }\n  fragment ProductCard on Product {\n    id\n    handle\n    title\n    vendor\n    availableForSale\n    description(truncateAt: 200)\n    featuredImage {\n      id\n      url\n      altText\n      width\n      height\n    }\n    priceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    badge: metafield(namespace: "mellow", key: "badge") {\n      value\n    }\n    shortDescription: metafield(namespace: "mellow", key: "short_description") {\n      value\n    }\n    rating: metafield(namespace: "reviews", key: "rating") {\n      value\n    }\n    ratingCount: metafield(namespace: "reviews", key: "rating_count") {\n      value\n    }\n  }\n\n': {
    return: ProductRecommendationsQuery;
    variables: ProductRecommendationsQueryVariables;
  };
  '#graphql\n  query RegularSearch(\n    $country: CountryCode\n    $endCursor: String\n    $first: Int\n    $language: LanguageCode\n    $last: Int\n    $term: String!\n    $startCursor: String\n  ) @inContext(country: $country, language: $language) {\n    articles: search(\n      query: $term,\n      types: [ARTICLE],\n      first: 10,\n    ) {\n      nodes {\n        ...on Article {\n          ...SearchArticle\n        }\n      }\n    }\n    pages: search(\n      query: $term,\n      types: [PAGE],\n      first: 10,\n    ) {\n      nodes {\n        ...on Page {\n          ...SearchPage\n        }\n      }\n    }\n    products: search(\n      after: $endCursor,\n      before: $startCursor,\n      first: $first,\n      last: $last,\n      query: $term,\n      sortKey: RELEVANCE,\n      types: [PRODUCT],\n      unavailableProducts: HIDE,\n    ) {\n      totalCount\n      nodes {\n        ...on Product {\n          ...SearchProduct\n        }\n      }\n      pageInfo {\n        ...PageInfoFragment\n      }\n    }\n  }\n  #graphql\n  fragment MoneyProductCard on MoneyV2 {\n    amount\n    currencyCode\n  }\n  fragment ProductCard on Product {\n    id\n    handle\n    title\n    vendor\n    availableForSale\n    description(truncateAt: 200)\n    featuredImage {\n      id\n      url\n      altText\n      width\n      height\n    }\n    priceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    compareAtPriceRange {\n      minVariantPrice {\n        ...MoneyProductCard\n      }\n    }\n    badge: metafield(namespace: "mellow", key: "badge") {\n      value\n    }\n    shortDescription: metafield(namespace: "mellow", key: "short_description") {\n      value\n    }\n    rating: metafield(namespace: "reviews", key: "rating") {\n      value\n    }\n    ratingCount: metafield(namespace: "reviews", key: "rating_count") {\n      value\n    }\n  }\n\n  #graphql\n  fragment SearchProduct on Product {\n    __typename\n    ...ProductCard\n    publishedAt\n    trackingParameters\n  }\n\n  #graphql\n  fragment SearchPage on Page {\n     __typename\n     handle\n    id\n    title\n    trackingParameters\n  }\n\n  #graphql\n  fragment SearchArticle on Article {\n    __typename\n    handle\n    id\n    title\n    trackingParameters\n    blog {\n      handle\n    }\n  }\n\n  #graphql\n  fragment PageInfoFragment on PageInfo {\n    hasNextPage\n    hasPreviousPage\n    startCursor\n    endCursor\n  }\n\n': {
    return: RegularSearchQuery;
    variables: RegularSearchQueryVariables;
  };
  '#graphql\n  query PredictiveSearch(\n    $country: CountryCode\n    $language: LanguageCode\n    $limit: Int!\n    $limitScope: PredictiveSearchLimitScope!\n    $term: String!\n    $types: [PredictiveSearchType!]\n  ) @inContext(country: $country, language: $language) {\n    predictiveSearch(\n      limit: $limit,\n      limitScope: $limitScope,\n      query: $term,\n      types: $types,\n    ) {\n      articles {\n        ...PredictiveArticle\n      }\n      collections {\n        ...PredictiveCollection\n      }\n      pages {\n        ...PredictivePage\n      }\n      products {\n        ...PredictiveProduct\n      }\n      queries {\n        ...PredictiveQuery\n      }\n    }\n  }\n  #graphql\n  fragment PredictiveArticle on Article {\n    __typename\n    id\n    title\n    handle\n    blog {\n      handle\n    }\n    image {\n      url\n      altText\n      width\n      height\n    }\n    trackingParameters\n  }\n\n  #graphql\n  fragment PredictiveCollection on Collection {\n    __typename\n    id\n    title\n    handle\n    image {\n      url\n      altText\n      width\n      height\n    }\n    trackingParameters\n  }\n\n  #graphql\n  fragment PredictivePage on Page {\n    __typename\n    id\n    title\n    handle\n    trackingParameters\n  }\n\n  #graphql\n  fragment PredictiveProduct on Product {\n    __typename\n    id\n    title\n    handle\n    trackingParameters\n    selectedOrFirstAvailableVariant(\n      selectedOptions: []\n      ignoreUnknownOptions: true\n      caseInsensitiveMatch: true\n    ) {\n      id\n      image {\n        url\n        altText\n        width\n        height\n      }\n      price {\n        amount\n        currencyCode\n      }\n      compareAtPrice {\n        amount\n        currencyCode\n      }\n    }\n  }\n\n  #graphql\n  fragment PredictiveQuery on SearchQuerySuggestion {\n    __typename\n    text\n    trackingParameters\n  }\n\n': {
    return: PredictiveSearchQuery;
    variables: PredictiveSearchQueryVariables;
  };
}

interface GeneratedMutationTypes {
  '#graphql\n  mutation cartCreate(\n    $input: CartInput!\n    $country: CountryCode = ZZ\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    cartCreate(input: $input) {\n      cart {\n        ...CartApiMutation\n      }\n      userErrors {\n        ...CartApiError\n      }\n      warnings {\n        ...CartApiWarning\n      }\n    }\n  }\n  #graphql\n  fragment CartApiMutation on Cart {\n    id\n    totalQuantity\n    checkoutUrl\n  }\n\n  #graphql\n  fragment CartApiError on CartUserError {\n    message\n    field\n    code\n  }\n\n  #graphql\n  fragment CartApiWarning on CartWarning {\n    code\n    message\n    target\n  }\n\n': {
    return: CartCreateMutation;
    variables: CartCreateMutationVariables;
  };
  '#graphql\n  mutation cartLinesAdd(\n    $cartId: ID!\n    $lines: [CartLineInput!]!\n    $country: CountryCode = ZZ\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    cartLinesAdd(cartId: $cartId, lines: $lines) {\n      cart {\n        ...CartApiMutation\n      }\n      userErrors {\n        ...CartApiError\n      }\n      warnings {\n        ...CartApiWarning\n      }\n    }\n  }\n  #graphql\n  fragment CartApiMutation on Cart {\n    id\n    totalQuantity\n    checkoutUrl\n  }\n\n  #graphql\n  fragment CartApiError on CartUserError {\n    message\n    field\n    code\n  }\n\n  #graphql\n  fragment CartApiWarning on CartWarning {\n    code\n    message\n    target\n  }\n\n': {
    return: CartLinesAddMutation;
    variables: CartLinesAddMutationVariables;
  };
  '#graphql\n  mutation cartLinesUpdate(\n    $cartId: ID!\n    $lines: [CartLineUpdateInput!]!\n    $country: CountryCode = ZZ\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    cartLinesUpdate(cartId: $cartId, lines: $lines) {\n      cart {\n        ...CartApiMutation\n      }\n      userErrors {\n        ...CartApiError\n      }\n      warnings {\n        ...CartApiWarning\n      }\n    }\n  }\n  #graphql\n  fragment CartApiMutation on Cart {\n    id\n    totalQuantity\n    checkoutUrl\n  }\n\n  #graphql\n  fragment CartApiError on CartUserError {\n    message\n    field\n    code\n  }\n\n  #graphql\n  fragment CartApiWarning on CartWarning {\n    code\n    message\n    target\n  }\n\n': {
    return: CartLinesUpdateMutation;
    variables: CartLinesUpdateMutationVariables;
  };
  '#graphql\n  mutation cartLinesRemove(\n    $cartId: ID!\n    $lineIds: [ID!]!\n    $country: CountryCode = ZZ\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {\n      cart {\n        ...CartApiMutation\n      }\n      userErrors {\n        ...CartApiError\n      }\n      warnings {\n        ...CartApiWarning\n      }\n    }\n  }\n  #graphql\n  fragment CartApiMutation on Cart {\n    id\n    totalQuantity\n    checkoutUrl\n  }\n\n  #graphql\n  fragment CartApiError on CartUserError {\n    message\n    field\n    code\n  }\n\n  #graphql\n  fragment CartApiWarning on CartWarning {\n    code\n    message\n    target\n  }\n\n': {
    return: CartLinesRemoveMutation;
    variables: CartLinesRemoveMutationVariables;
  };
  '#graphql\n  mutation cartDiscountCodesUpdate(\n    $cartId: ID!\n    $discountCodes: [String!]!\n    $country: CountryCode = ZZ\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {\n      cart {\n        ...CartApiMutation\n      }\n      userErrors {\n        ...CartApiError\n      }\n      warnings {\n        ...CartApiWarning\n      }\n    }\n  }\n  #graphql\n  fragment CartApiMutation on Cart {\n    id\n    totalQuantity\n    checkoutUrl\n  }\n\n  #graphql\n  fragment CartApiError on CartUserError {\n    message\n    field\n    code\n  }\n\n  #graphql\n  fragment CartApiWarning on CartWarning {\n    code\n    message\n    target\n  }\n\n': {
    return: CartDiscountCodesUpdateMutation;
    variables: CartDiscountCodesUpdateMutationVariables;
  };
  '#graphql\n  mutation cartGiftCardCodesAdd(\n    $cartId: ID!\n    $giftCardCodes: [String!]!\n    $country: CountryCode = ZZ\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    cartGiftCardCodesAdd(cartId: $cartId, giftCardCodes: $giftCardCodes) {\n      cart {\n        ...CartApiMutation\n      }\n      userErrors {\n        ...CartApiError\n      }\n      warnings {\n        ...CartApiWarning\n      }\n    }\n  }\n  #graphql\n  fragment CartApiMutation on Cart {\n    id\n    totalQuantity\n    checkoutUrl\n  }\n\n  #graphql\n  fragment CartApiError on CartUserError {\n    message\n    field\n    code\n  }\n\n  #graphql\n  fragment CartApiWarning on CartWarning {\n    code\n    message\n    target\n  }\n\n': {
    return: CartGiftCardCodesAddMutation;
    variables: CartGiftCardCodesAddMutationVariables;
  };
  '#graphql\n  mutation cartGiftCardCodesRemove(\n    $cartId: ID!\n    $appliedGiftCardIds: [ID!]!\n    $country: CountryCode = ZZ\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    cartGiftCardCodesRemove(\n      cartId: $cartId\n      appliedGiftCardIds: $appliedGiftCardIds\n    ) {\n      cart {\n        ...CartApiMutation\n      }\n      userErrors {\n        ...CartApiError\n      }\n      warnings {\n        ...CartApiWarning\n      }\n    }\n  }\n  #graphql\n  fragment CartApiMutation on Cart {\n    id\n    totalQuantity\n    checkoutUrl\n  }\n\n  #graphql\n  fragment CartApiError on CartUserError {\n    message\n    field\n    code\n  }\n\n  #graphql\n  fragment CartApiWarning on CartWarning {\n    code\n    message\n    target\n  }\n\n': {
    return: CartGiftCardCodesRemoveMutation;
    variables: CartGiftCardCodesRemoveMutationVariables;
  };
  '#graphql\n  mutation cartBuyerIdentityUpdate(\n    $cartId: ID!\n    $buyerIdentity: CartBuyerIdentityInput!\n    $country: CountryCode = ZZ\n    $language: LanguageCode\n  ) @inContext(country: $country, language: $language) {\n    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {\n      cart {\n        ...CartApiMutation\n      }\n      userErrors {\n        ...CartApiError\n      }\n      warnings {\n        ...CartApiWarning\n      }\n    }\n  }\n  #graphql\n  fragment CartApiMutation on Cart {\n    id\n    totalQuantity\n    checkoutUrl\n  }\n\n  #graphql\n  fragment CartApiError on CartUserError {\n    message\n    field\n    code\n  }\n\n  #graphql\n  fragment CartApiWarning on CartWarning {\n    code\n    message\n    target\n  }\n\n': {
    return: CartBuyerIdentityUpdateMutation;
    variables: CartBuyerIdentityUpdateMutationVariables;
  };
}

declare global {
  interface StorefrontQueries extends GeneratedQueryTypes {}
  interface StorefrontMutations extends GeneratedMutationTypes {}
}
