import "server-only";

import { decryptSecret } from "@/lib/crypto";

export type OzonUploadInput = {
  store: {
    ozonStoreId: string;
    ozonClientId: string;
    apiKeyEncrypted: string;
  };
  product: {
    title: string;
    description: string;
    price: unknown;
    images: unknown;
  };
};

export async function uploadProductToOzon(input: OzonUploadInput) {
  const apiKey = decryptSecret(input.store.apiKeyEncrypted);

  return {
    mode: "mock-adapter",
    ozonStoreId: input.store.ozonStoreId,
    ozonClientId: input.store.ozonClientId,
    apiKeyLoaded: Boolean(apiKey),
    externalId: `mock_ozon_${Date.now()}`,
    productTitle: input.product.title
  };
}
