import { AppShell } from "@/components/AppShell";
import { OzonStoreConsole } from "@/components/OzonStoreConsole";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StoresPage() {
  const user = await requireApprovedUser();
  const stores = await prisma.store.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });
  const consoleStores = stores.map((store) => ({
    id: store.id,
    name: store.name,
    ozonStoreId: store.ozonStoreId,
    ozonClientId: store.ozonClientId,
    apiKeyState: store.apiKeyEncrypted ? "API Key 已加密保存" : "API Key 未设置",
    createdAt: store.createdAt.toLocaleString()
  }));

  return (
    <AppShell title="Ozon 店铺" eyebrow="Store Registry" user={user}>
      <OzonStoreConsole stores={consoleStores} />
    </AppShell>
  );
}
