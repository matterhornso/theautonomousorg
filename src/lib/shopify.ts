/**
 * Shopify Admin API GraphQL client (v1 — getsoma.store).
 *
 * Single-tenant for now: reads SHOPIFY_STORE_DOMAIN + SHOPIFY_CLIENT_ID +
 * SHOPIFY_CLIENT_SECRET from env. When we onboard a second Shopify merchant
 * we'll move these to a per-firm `integrations` row and pass the credentials in.
 *
 * Auth: Shopify deprecated static admin tokens in 2026. Apps created via the
 * Dev Dashboard issue a Client ID + Client Secret; we exchange them for a
 * 24-hour access token via the client credentials grant
 * (POST /admin/oauth/access_token). The exchanged token is `shpat_…` and is
 * sent as `X-Shopify-Access-Token` against the GraphQL API.
 *
 * Why GraphQL over REST: REST resources are deprecated. Bulk edits and
 * field-level updates are simpler in GraphQL, and `extensions.cost` gives us
 * throttling info on every response.
 */

const DEFAULT_API_VERSION = "2026-04";

export interface ShopifyConfig {
  storeDomain: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
}

export function loadShopifyConfig(overrides?: Partial<ShopifyConfig>): ShopifyConfig {
  const storeDomain = overrides?.storeDomain ?? process.env.SHOPIFY_STORE_DOMAIN;
  const clientId = overrides?.clientId ?? process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = overrides?.clientSecret ?? process.env.SHOPIFY_CLIENT_SECRET;
  const apiVersion =
    overrides?.apiVersion ?? process.env.SHOPIFY_API_VERSION ?? DEFAULT_API_VERSION;

  if (!storeDomain) {
    throw new Error(
      "SHOPIFY_STORE_DOMAIN is not configured. Set it in .env.local (e.g. zizrev-ej.myshopify.com)."
    );
  }
  if (!clientId) {
    throw new Error(
      "SHOPIFY_CLIENT_ID is not configured. Find it in your Dev Dashboard app's API credentials."
    );
  }
  if (!clientSecret) {
    throw new Error(
      "SHOPIFY_CLIENT_SECRET is not configured. Find it in your Dev Dashboard app's API credentials."
    );
  }
  return { storeDomain, clientId, clientSecret, apiVersion };
}

export function isShopifyConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_STORE_DOMAIN &&
      process.env.SHOPIFY_CLIENT_ID &&
      process.env.SHOPIFY_CLIENT_SECRET
  );
}

/**
 * Service name in user_api_keys for a tenant's Shopify credentials.
 * The encrypted value is a JSON blob: { storeDomain, clientId, clientSecret, apiVersion? }
 */
const SHOPIFY_CREDS_SERVICE = "shopify_credentials";

/**
 * Resolve the Shopify config for a specific company.
 *
 * Order of preference:
 *   1. user_api_keys row with service_name='shopify_credentials' (JSON blob)
 *   2. env (SHOPIFY_STORE_DOMAIN + SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET)
 *
 * Returns null if neither is configured.
 */
export async function loadShopifyConfigForCompany(
  companyId: string
): Promise<ShopifyConfig | null> {
  try {
    const { getUserApiKey } = await import("./db");
    const raw = await getUserApiKey(companyId, SHOPIFY_CREDS_SERVICE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ShopifyConfig>;
      if (parsed.storeDomain && parsed.clientId && parsed.clientSecret) {
        return {
          storeDomain: parsed.storeDomain,
          clientId: parsed.clientId,
          clientSecret: parsed.clientSecret,
          apiVersion: parsed.apiVersion ?? DEFAULT_API_VERSION,
        };
      }
    }
  } catch {
    // db unavailable or row malformed — fall through to env
  }
  if (isShopifyConfigured()) {
    try {
      return loadShopifyConfig();
    } catch {
      return null;
    }
  }
  return null;
}

/** True if the company has its own Shopify credentials configured (BYOK). */
export async function isShopifyBYOK(companyId: string): Promise<boolean> {
  try {
    const { getUserApiKey } = await import("./db");
    return Boolean(await getUserApiKey(companyId, SHOPIFY_CREDS_SERVICE));
  } catch {
    return false;
  }
}

// ─── Token cache (per process, per store) ──────────────────────────────
// 24h tokens are cached in memory keyed by storeDomain. We refresh ~5 min
// before expiry so a long-running serverless invocation doesn't hit a fresh
// 401 mid-request.

interface CachedToken {
  token: string;
  expiresAt: number;
  scope: string;
}
const tokenCache = new Map<string, CachedToken>();
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface ClientCredentialsResponse {
  access_token: string;
  scope: string;
  expires_in: number;
}

/**
 * Exchange client_id + client_secret for an Admin API access token via the
 * client credentials grant. Result is cached in-process until ~5 min before
 * expiry; subsequent calls return the cached token.
 *
 * Exposed for tests; production callers go through `shopifyGraphQL`.
 */
export async function getAccessToken(config?: ShopifyConfig): Promise<string> {
  const cfg = config ?? loadShopifyConfig();
  const cached = tokenCache.get(cfg.storeDomain);
  if (cached && cached.expiresAt - REFRESH_BUFFER_MS > Date.now()) {
    return cached.token;
  }
  const url = `https://${cfg.storeDomain}/admin/oauth/access_token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as
    | ClientCredentialsResponse
    | { error: string; error_description?: string };
  if (!res.ok || !("access_token" in json)) {
    const detail =
      "error" in json
        ? `${json.error}${json.error_description ? `: ${json.error_description}` : ""}`
        : `HTTP ${res.status}`;
    throw new ShopifyError(
      `Shopify token exchange failed (${detail}). Check SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET.`,
      res.status,
      json
    );
  }
  tokenCache.set(cfg.storeDomain, {
    token: json.access_token,
    scope: json.scope,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  return json.access_token;
}

/** Test-only: clear cached tokens. */
export function _resetShopifyTokenCache(): void {
  tokenCache.clear();
}

/** Test-only: prime the cache so callers skip the OAuth exchange. */
export function _primeShopifyTokenCache(
  storeDomain: string,
  token: string,
  // Default 1 hour, comfortably past the 5-minute REFRESH_BUFFER_MS so primed
  // tokens stay fresh for the duration of a test run.
  expiresInMs = 60 * 60 * 1000
): void {
  tokenCache.set(storeDomain, {
    token,
    scope: "test",
    expiresAt: Date.now() + expiresInMs,
  });
}

export class ShopifyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "ShopifyError";
  }
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export async function shopifyGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {},
  config?: ShopifyConfig
): Promise<T> {
  const cfg = config ?? loadShopifyConfig();
  const token = await getAccessToken(cfg);
  const url = `https://${cfg.storeDomain}/admin/api/${cfg.apiVersion}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as GraphQLResponse<T>;
  if (!res.ok) {
    throw new ShopifyError(
      `Shopify Admin API error ${res.status}`,
      res.status,
      json
    );
  }
  if (json.errors?.length) {
    throw new ShopifyError(
      `Shopify GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`,
      200,
      json
    );
  }
  if (!json.data) {
    throw new ShopifyError("Shopify GraphQL returned no data", res.status, json);
  }
  return json.data;
}

// ─── Domain types (subset of Shopify schema) ─────────────────────────────

export interface ShopifyProductSummary {
  id: string;
  title: string;
  handle: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  vendor: string;
  productType: string;
  tags: string[];
  description: string;
  variants: ShopifyVariant[];
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
}

// ─── Shop info (cached) ──────────────────────────────────────────────────

export interface ShopInfo {
  name: string;
  myshopifyDomain: string;
  primaryDomainUrl: string;
}

interface CachedShopInfo {
  info: ShopInfo;
  fetchedAt: number;
}
const shopInfoCache = new Map<string, CachedShopInfo>();
const SHOP_INFO_TTL_MS = 60 * 60 * 1000; // 1 hour — name/domain rarely change

const SHOP_INFO_QUERY = `#graphql
  query ShopInfo {
    shop {
      name
      myshopifyDomain
      primaryDomain { url }
    }
  }
`;

/**
 * Fetches the shop's name + primary domain. Cached in-process for 1 hour.
 * Used by the admin UI to display a friendlier label than the raw
 * .myshopify.com handle.
 */
export async function getShopInfo(config?: ShopifyConfig): Promise<ShopInfo> {
  const cfg = config ?? loadShopifyConfig();
  const cached = shopInfoCache.get(cfg.storeDomain);
  if (cached && Date.now() - cached.fetchedAt < SHOP_INFO_TTL_MS) {
    return cached.info;
  }
  const data = await shopifyGraphQL<{
    shop: { name: string; myshopifyDomain: string; primaryDomain: { url: string } };
  }>(SHOP_INFO_QUERY, {}, cfg);
  const info: ShopInfo = {
    name: data.shop.name,
    myshopifyDomain: data.shop.myshopifyDomain,
    primaryDomainUrl: data.shop.primaryDomain.url,
  };
  shopInfoCache.set(cfg.storeDomain, { info, fetchedAt: Date.now() });
  return info;
}

/** Test-only: clear shop info cache. */
export function _resetShopInfoCache(): void {
  shopInfoCache.clear();
}

// ─── Read operations ─────────────────────────────────────────────────────

const SEARCH_PRODUCTS_QUERY = `#graphql
  query SearchProducts($query: String, $first: Int!) {
    products(query: $query, first: $first) {
      edges {
        node {
          id
          title
          handle
          status
          vendor
          productType
          tags
          description
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }
`;

interface SearchProductsResponse {
  products: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        handle: string;
        status: ShopifyProductSummary["status"];
        vendor: string;
        productType: string;
        tags: string[];
        description: string;
        variants: { edges: Array<{ node: ShopifyVariant }> };
      };
    }>;
  };
}

export async function searchProducts(
  query: string,
  first = 10,
  config?: ShopifyConfig
): Promise<ShopifyProductSummary[]> {
  const data = await shopifyGraphQL<SearchProductsResponse>(
    SEARCH_PRODUCTS_QUERY,
    { query, first },
    config
  );
  return data.products.edges.map(({ node }) => ({
    id: node.id,
    title: node.title,
    handle: node.handle,
    status: node.status,
    vendor: node.vendor,
    productType: node.productType,
    tags: node.tags,
    description: node.description,
    variants: node.variants.edges.map((e) => e.node),
  }));
}

// ─── Mutation operations ─────────────────────────────────────────────────

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation ProductUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        title
        status
        tags
        description
      }
      userErrors { field message }
    }
  }
`;

export interface ProductUpdateInput {
  id: string;
  title?: string;
  descriptionHtml?: string;
  tags?: string[];
  status?: "ACTIVE" | "ARCHIVED" | "DRAFT";
  vendor?: string;
  productType?: string;
}

export async function updateProduct(
  input: ProductUpdateInput,
  config?: ShopifyConfig
): Promise<{
  id: string;
  title: string;
  status: string;
  tags: string[];
  description: string;
}> {
  const data = await shopifyGraphQL<{
    productUpdate: {
      product: {
        id: string;
        title: string;
        status: string;
        tags: string[];
        description: string;
      } | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(PRODUCT_UPDATE_MUTATION, { input }, config);

  if (data.productUpdate.userErrors.length > 0) {
    throw new ShopifyError(
      `productUpdate failed: ${data.productUpdate.userErrors
        .map((e) => `${e.field?.join(".") ?? "?"}: ${e.message}`)
        .join("; ")}`,
      200,
      data.productUpdate.userErrors
    );
  }
  if (!data.productUpdate.product) {
    throw new ShopifyError("productUpdate returned null product", 200, data);
  }
  return data.productUpdate.product;
}

const VARIANT_UPDATE_MUTATION = `#graphql
  mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product { id }
      productVariants {
        id
        title
        price
        compareAtPrice
      }
      userErrors { field message }
    }
  }
`;

export interface VariantPriceUpdate {
  id: string;
  price?: string;
  compareAtPrice?: string | null;
}

export async function updateVariantPrices(
  productId: string,
  variants: VariantPriceUpdate[],
  config?: ShopifyConfig
): Promise<Array<{ id: string; title: string; price: string; compareAtPrice: string | null }>> {
  const data = await shopifyGraphQL<{
    productVariantsBulkUpdate: {
      productVariants: Array<{
        id: string;
        title: string;
        price: string;
        compareAtPrice: string | null;
      }> | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(
    VARIANT_UPDATE_MUTATION,
    { productId, variants },
    config
  );
  if (data.productVariantsBulkUpdate.userErrors.length > 0) {
    throw new ShopifyError(
      `productVariantsBulkUpdate failed: ${data.productVariantsBulkUpdate.userErrors
        .map((e) => `${e.field?.join(".") ?? "?"}: ${e.message}`)
        .join("; ")}`,
      200,
      data.productVariantsBulkUpdate.userErrors
    );
  }
  return data.productVariantsBulkUpdate.productVariants ?? [];
}
