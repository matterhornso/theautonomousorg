import { isShopifyConfigured, getShopInfo, type ShopInfo } from "@/lib/shopify";
import { resolveTenant } from "../_lib/resolve-tenant";
import {
  PageHeader,
  Section,
  EmptyState,
  Code,
} from "../_components/primitives";
import { ShopifyEditor } from "./_components/shopify-editor";

export default async function ShopifyAdminPage() {
  const { firm } = await resolveTenant();
  const configured = isShopifyConfigured();

  // Fetch the friendly shop label (name + primary domain) from Shopify when
  // configured. Cached for 1h in-process. If the call fails (network, expired
  // token, etc.), fall back to the raw env handle so the page still renders.
  let shopInfo: ShopInfo | null = null;
  let shopInfoError: string | null = null;
  if (configured) {
    try {
      shopInfo = await getShopInfo();
    } catch (err) {
      shopInfoError = err instanceof Error ? err.message : String(err);
    }
  }
  const fallbackDomain = process.env.SHOPIFY_STORE_DOMAIN ?? "";
  const friendlyLabel = shopInfo
    ? `${shopInfo.name} (${new URL(shopInfo.primaryDomainUrl).host})`
    : fallbackDomain;

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        eyebrow={
          configured && shopInfo
            ? `${shopInfo.name} · Shopify Editor`
            : "Shopify Editor"
        }
        title="Edit your store from a sentence."
        description={
          configured
            ? `Connected to ${friendlyLabel}. Describe a change in plain English. We'll search the catalog, propose the exact mutations, and only apply them once you say "go."`
            : "Connect a Shopify custom app first. Then describe a change in plain English and we'll plan it before applying anything."
        }
      />
      {shopInfoError && (
        <div className="text-[12px] text-[#7a5212] bg-[#C4891A]/10 border border-[#C4891A]/20 rounded-md px-4 py-2">
          Could not fetch shop label from Shopify ({shopInfoError}). Falling back to the env handle.
        </div>
      )}

      {!configured ? (
        <Section title="Setup">
          <EmptyState
            title="Shopify not configured"
            description="Set SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET in your environment, restart the dev server, and refresh. The runtime exchanges the client credentials for a 24h access token automatically."
            action={
              <div className="text-left max-w-lg mx-auto mt-4">
                <Code block>
                  {`# .env.local
SHOPIFY_STORE_DOMAIN=zizrev-ej.myshopify.com
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=shpss_...
SHOPIFY_API_VERSION=2026-04`}
                </Code>
              </div>
            }
          />
        </Section>
      ) : (
        <ShopifyEditor />
      )}
    </div>
  );
}
