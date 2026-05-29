import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { maskSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export default async function StoresPage() {
  const user = await requireApprovedUser();
  const stores = await prisma.store.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppShell title="Ozon 店铺" eyebrow="Store Registry" user={user}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-steel">统一绑定 Ozon 跨境电商店铺，不再区分俄罗斯或哈萨克斯坦。至少绑定一个店铺后，后续才能接入上传到 Ozon。</p>
        <Link href="/stores/new" className="btn-primary w-fit">
          <Plus size={17} />
          绑定店铺
        </Link>
      </div>

      <div className="ledger-card overflow-hidden">
        <div className="grid grid-cols-12 border-b border-line bg-rail/45 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-steel">
          <span className="col-span-4">店铺名称</span>
          <span className="col-span-3">Ozon Store ID</span>
          <span className="col-span-2">Client ID</span>
          <span className="col-span-3 text-right">API Key</span>
        </div>

        {stores.length === 0 && <p className="p-5 text-sm text-steel">暂无绑定店铺。</p>}

        {stores.map((store) => (
          <div key={store.id} className="grid grid-cols-12 items-center gap-3 border-b border-line px-4 py-4 last:border-b-0">
            <div className="col-span-12 md:col-span-4">
              <p className="font-display text-2xl">{store.name}</p>
              <p className="mt-1 text-xs text-steel">{store.createdAt.toLocaleString()}</p>
            </div>
            <div className="col-span-12 text-sm text-steel md:col-span-3">{store.ozonStoreId}</div>
            <div className="col-span-12 text-sm text-steel md:col-span-2">{store.ozonClientId}</div>
            <div className="col-span-12 text-sm text-steel md:col-span-3 md:text-right">{maskSecret(store.apiKeyEncrypted)}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
