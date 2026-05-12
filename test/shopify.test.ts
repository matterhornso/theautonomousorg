/**
 * Unit tests for the Shopify primitives + planner + apply.
 *
 * No live Shopify calls. fetch is mocked at module level. The planner test
 * stubs Anthropic at the SDK level via vi.mock so we exercise the tool-use
 * loop without making an LLM call.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadShopifyConfig,
  isShopifyConfigured,
  searchProducts,
  updateProduct,
  updateVariantPrices,
  ShopifyError,
  getAccessToken,
  _resetShopifyTokenCache,
  _primeShopifyTokenCache,
} from "@/lib/shopify";
import { applyPlan } from "@/lib/shopify-apply";
import { planSchema, planShopifyEdit } from "@/lib/shopify-planner";

const STUB_CONFIG = {
  storeDomain: "test-shop.myshopify.com",
  clientId: "stub_client_id",
  clientSecret: "shpss_stub_secret",
  apiVersion: "2026-04",
};

const PRODUCT_GID = "gid://shopify/Product/1234567890";
const VARIANT_GID = "gid://shopify/ProductVariant/9999";

describe("loadShopifyConfig", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("reads from env when no overrides", () => {
    process.env.SHOPIFY_STORE_DOMAIN = "x.myshopify.com";
    process.env.SHOPIFY_CLIENT_ID = "id_x";
    process.env.SHOPIFY_CLIENT_SECRET = "shpss_x";
    delete process.env.SHOPIFY_API_VERSION;
    const cfg = loadShopifyConfig();
    expect(cfg.storeDomain).toBe("x.myshopify.com");
    expect(cfg.clientId).toBe("id_x");
    expect(cfg.clientSecret).toBe("shpss_x");
    expect(cfg.apiVersion).toBe("2026-04");
  });

  it("throws when SHOPIFY_STORE_DOMAIN is missing", () => {
    delete process.env.SHOPIFY_STORE_DOMAIN;
    process.env.SHOPIFY_CLIENT_ID = "id_x";
    process.env.SHOPIFY_CLIENT_SECRET = "shpss_x";
    expect(() => loadShopifyConfig()).toThrow(/SHOPIFY_STORE_DOMAIN/);
  });

  it("throws when SHOPIFY_CLIENT_ID is missing", () => {
    process.env.SHOPIFY_STORE_DOMAIN = "x.myshopify.com";
    delete process.env.SHOPIFY_CLIENT_ID;
    process.env.SHOPIFY_CLIENT_SECRET = "shpss_x";
    expect(() => loadShopifyConfig()).toThrow(/SHOPIFY_CLIENT_ID/);
  });

  it("throws when SHOPIFY_CLIENT_SECRET is missing", () => {
    process.env.SHOPIFY_STORE_DOMAIN = "x.myshopify.com";
    process.env.SHOPIFY_CLIENT_ID = "id_x";
    delete process.env.SHOPIFY_CLIENT_SECRET;
    expect(() => loadShopifyConfig()).toThrow(/SHOPIFY_CLIENT_SECRET/);
  });

  it("isShopifyConfigured reflects env presence", () => {
    process.env.SHOPIFY_STORE_DOMAIN = "x.myshopify.com";
    process.env.SHOPIFY_CLIENT_ID = "id_x";
    process.env.SHOPIFY_CLIENT_SECRET = "shpss_x";
    expect(isShopifyConfigured()).toBe(true);
    delete process.env.SHOPIFY_CLIENT_SECRET;
    expect(isShopifyConfigured()).toBe(false);
  });
});

describe("getAccessToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetShopifyTokenCache();
  });

  it("exchanges client credentials, returns access_token, and caches it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "shpat_exchanged",
        scope: "write_products",
        expires_in: 86399,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const t1 = await getAccessToken(STUB_CONFIG);
    const t2 = await getAccessToken(STUB_CONFIG);
    expect(t1).toBe("shpat_exchanged");
    expect(t2).toBe("shpat_exchanged");
    // Second call should be served from cache — only one network call.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://test-shop.myshopify.com/admin/oauth/access_token");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(init.body).toContain("grant_type=client_credentials");
    expect(init.body).toContain("client_id=stub_client_id");
    expect(init.body).toContain("client_secret=shpss_stub_secret");
  });

  it("throws ShopifyError when exchange returns 401 / invalid_client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: "invalid_client",
          error_description: "Client authentication failed",
        }),
      })
    );
    await expect(getAccessToken(STUB_CONFIG)).rejects.toThrow(/invalid_client/);
  });
});

describe("searchProducts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetShopifyTokenCache();
    _primeShopifyTokenCache(STUB_CONFIG.storeDomain, "shpat_test");
  });

  it("posts to the correct admin GraphQL URL with the access token header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { products: { edges: [] } },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchProducts("vendor:Soma", 5, STUB_CONFIG);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "https://test-shop.myshopify.com/admin/api/2026-04/graphql.json"
    );
    expect(init.method).toBe("POST");
    expect(init.headers["X-Shopify-Access-Token"]).toBe("shpat_test");
    const body = JSON.parse(init.body);
    expect(body.variables).toEqual({ query: "vendor:Soma", first: 5 });
  });

  it("flattens the edges/node response into ShopifyProductSummary[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          products: {
            edges: [
              {
                node: {
                  id: PRODUCT_GID,
                  title: "Hoodie",
                  handle: "hoodie",
                  status: "ACTIVE",
                  vendor: "Soma",
                  productType: "Apparel",
                  tags: ["hoodie", "winter"],
                  description: "Cozy hoodie",
                  variants: {
                    edges: [
                      {
                        node: {
                          id: VARIANT_GID,
                          title: "M",
                          sku: "SOMA-HOOD-M",
                          price: "59.00",
                          compareAtPrice: null,
                          inventoryQuantity: 12,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchProducts("Hoodie", 1, STUB_CONFIG);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("Hoodie");
    expect(result[0]!.variants).toHaveLength(1);
    expect(result[0]!.variants[0]!.price).toBe("59.00");
  });

  it("throws ShopifyError on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ errors: [{ message: "unauthorized" }] }),
      })
    );
    await expect(searchProducts("foo", 1, STUB_CONFIG)).rejects.toThrow(ShopifyError);
  });

  it("throws ShopifyError on GraphQL errors even when HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          errors: [{ message: "Field 'foo' doesn't exist" }],
        }),
      })
    );
    await expect(searchProducts("foo", 1, STUB_CONFIG)).rejects.toThrow(
      /GraphQL error/
    );
  });
});

describe("updateProduct", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetShopifyTokenCache();
    _primeShopifyTokenCache(STUB_CONFIG.storeDomain, "shpat_test");
  });

  it("calls productUpdate and returns the updated product", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          productUpdate: {
            product: {
              id: PRODUCT_GID,
              title: "Hoodie",
              status: "DRAFT",
              tags: ["clearance"],
              description: "...",
            },
            userErrors: [],
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateProduct(
      { id: PRODUCT_GID, status: "DRAFT", tags: ["clearance"] },
      STUB_CONFIG
    );
    expect(result.status).toBe("DRAFT");
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.variables.input).toEqual({
      id: PRODUCT_GID,
      status: "DRAFT",
      tags: ["clearance"],
    });
  });

  it("throws when userErrors are non-empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            productUpdate: {
              product: null,
              userErrors: [
                { field: ["input", "tags"], message: "Tag is invalid" },
              ],
            },
          },
        }),
      })
    );
    await expect(
      updateProduct({ id: PRODUCT_GID, tags: ["bad"] }, STUB_CONFIG)
    ).rejects.toThrow(/Tag is invalid/);
  });
});

describe("updateVariantPrices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetShopifyTokenCache();
    _primeShopifyTokenCache(STUB_CONFIG.storeDomain, "shpat_test");
  });

  it("calls productVariantsBulkUpdate", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          productVariantsBulkUpdate: {
            productVariants: [
              { id: VARIANT_GID, title: "M", price: "49.00", compareAtPrice: null },
            ],
            userErrors: [],
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await updateVariantPrices(
      PRODUCT_GID,
      [{ id: VARIANT_GID, price: "49.00" }],
      STUB_CONFIG
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.price).toBe("49.00");
  });
});

describe("planSchema", () => {
  it("accepts a valid update_product op", () => {
    const result = planSchema.safeParse({
      summary: "Tag clearance products.",
      operations: [
        {
          kind: "update_product",
          productId: PRODUCT_GID,
          productTitle: "Hoodie",
          changes: { tags: ["clearance"] },
          rationale: "Move to clearance per instruction.",
        },
      ],
      warnings: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an update_product op with no changes", () => {
    const result = planSchema.safeParse({
      summary: "noop",
      operations: [
        {
          kind: "update_product",
          productId: PRODUCT_GID,
          productTitle: "Hoodie",
          changes: {},
          rationale: "n/a",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed productId GID", () => {
    const result = planSchema.safeParse({
      summary: "x",
      operations: [
        {
          kind: "update_product",
          productId: "12345",
          productTitle: "Hoodie",
          changes: { tags: ["x"] },
          rationale: "x",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid price format", () => {
    const result = planSchema.safeParse({
      summary: "x",
      operations: [
        {
          kind: "update_variant_prices",
          productId: PRODUCT_GID,
          productTitle: "Hoodie",
          variants: [
            {
              variantId: VARIANT_GID,
              variantTitle: "M",
              currentPrice: "59.00",
              newPrice: "fifty",
            },
          ],
          rationale: "x",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("planShopifyEdit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetShopifyTokenCache();
    _primeShopifyTokenCache(STUB_CONFIG.storeDomain, "shpat_test");
  });

  it("loops search_products → submit_plan and returns the parsed plan", async () => {
    // First model turn: emit a search_products call.
    // Second model turn: emit submit_plan with a valid plan.
    const responses = [
      {
        content: [
          {
            type: "tool_use",
            id: "tu1",
            name: "search_products",
            input: { query: "tag:clearance", first: 5 },
          },
        ],
        usage: { input_tokens: 50, output_tokens: 20 },
      },
      {
        content: [
          {
            type: "tool_use",
            id: "tu2",
            name: "submit_plan",
            input: {
              summary: "Tag clearance products.",
              operations: [
                {
                  kind: "update_product",
                  productId: PRODUCT_GID,
                  productTitle: "Hoodie",
                  changes: { tags: ["clearance", "winter"] },
                  rationale: "User asked to add clearance tag.",
                },
              ],
              warnings: [],
            },
          },
        ],
        usage: { input_tokens: 60, output_tokens: 40 },
      },
    ];
    let i = 0;
    const stubClient = {
      messages: {
        create: vi.fn(async () => responses[i++]),
      },
    };

    // search_products tool dispatches via the real searchProducts → fetch.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            products: {
              edges: [
                {
                  node: {
                    id: PRODUCT_GID,
                    title: "Hoodie",
                    handle: "hoodie",
                    status: "ACTIVE",
                    vendor: "Soma",
                    productType: "Apparel",
                    tags: ["winter"],
                    description: "",
                    variants: { edges: [] },
                  },
                },
              ],
            },
          },
        }),
      })
    );

    const result = await planShopifyEdit("Add 'clearance' tag to clearance items.", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: stubClient as any,
      shopifyConfig: STUB_CONFIG,
      maxIterations: 5,
    });

    expect(result.plan.operations).toHaveLength(1);
    expect(result.plan.operations[0]!.productTitle).toBe("Hoodie");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe("search_products");
    expect(stubClient.messages.create).toHaveBeenCalledTimes(2);
  });

  it("throws when submit_plan input fails schema validation", async () => {
    const stubClient = {
      messages: {
        create: vi.fn(async () => ({
          content: [
            {
              type: "tool_use",
              id: "tu1",
              name: "submit_plan",
              input: {
                summary: "x",
                operations: [
                  {
                    kind: "update_product",
                    productId: "not-a-gid",
                    productTitle: "Hoodie",
                    changes: { tags: ["x"] },
                    rationale: "x",
                  },
                ],
              },
            },
          ],
          usage: { input_tokens: 10, output_tokens: 10 },
        })),
      },
    };
    await expect(
      planShopifyEdit("x", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: stubClient as any,
        shopifyConfig: STUB_CONFIG,
      })
    ).rejects.toThrow(/invalid plan/);
  });
});

describe("applyPlan", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetShopifyTokenCache();
    _primeShopifyTokenCache(STUB_CONFIG.storeDomain, "shpat_test");
  });

  it("runs each operation and reports per-op success", async () => {
    const fetchMock = vi.fn();
    fetchMock
      // op 1: update_product
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            productUpdate: {
              product: {
                id: PRODUCT_GID,
                title: "Hoodie",
                status: "DRAFT",
                tags: [],
                description: "",
              },
              userErrors: [],
            },
          },
        }),
      })
      // op 2: update_variant_prices
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            productVariantsBulkUpdate: {
              productVariants: [
                { id: VARIANT_GID, title: "M", price: "49.00", compareAtPrice: null },
              ],
              userErrors: [],
            },
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await applyPlan(
      {
        summary: "x",
        operations: [
          {
            kind: "update_product",
            productId: PRODUCT_GID,
            productTitle: "Hoodie",
            changes: { status: "DRAFT" },
            rationale: "test",
          },
          {
            kind: "update_variant_prices",
            productId: PRODUCT_GID,
            productTitle: "Hoodie",
            variants: [
              {
                variantId: VARIANT_GID,
                variantTitle: "M",
                currentPrice: "59.00",
                newPrice: "49.00",
              },
            ],
            rationale: "test",
          },
        ],
        warnings: [],
      },
      STUB_CONFIG
    );

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.ok).toBe(true);
    expect(result.results[1]!.ok).toBe(true);
  });

  it("continues past a failed op and records the error", async () => {
    const fetchMock = vi.fn();
    fetchMock
      // op 1: failure (userErrors)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            productUpdate: {
              product: null,
              userErrors: [{ field: null, message: "Boom" }],
            },
          },
        }),
      })
      // op 2: success
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            productUpdate: {
              product: {
                id: PRODUCT_GID,
                title: "Hoodie",
                status: "ACTIVE",
                tags: ["a"],
                description: "",
              },
              userErrors: [],
            },
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await applyPlan(
      {
        summary: "x",
        operations: [
          {
            kind: "update_product",
            productId: PRODUCT_GID,
            productTitle: "Hoodie",
            changes: { tags: ["bad"] },
            rationale: "x",
          },
          {
            kind: "update_product",
            productId: PRODUCT_GID,
            productTitle: "Hoodie",
            changes: { tags: ["a"] },
            rationale: "x",
          },
        ],
        warnings: [],
      },
      STUB_CONFIG
    );

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.results[0]!.ok).toBe(false);
    expect(result.results[0]!.error).toMatch(/Boom/);
    expect(result.results[1]!.ok).toBe(true);
  });
});
