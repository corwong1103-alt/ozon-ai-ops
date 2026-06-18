import Link from "next/link";
import { PackageCheck, Rocket } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OzonStoreConsole } from "@/components/OzonStoreConsole";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StoresPage() {
  const user = await requireApprovedUser();
  const [stores, readyCount, publishedCount] = await Promise.all([
    prisma.store.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      distinct: ["ozonStoreId"]
    }),
    prisma.product.count({ where: { userId: user.id, status: { in: ["ready_to_publish", "optimized"] } } }),
    prisma.product.count({ where: { userId: user.id, status: "published" } })
  ]);
  const consoleStores = stores.map((store) => ({
    id: store.id,
    name: store.name,
    ozonStoreId: store.ozonStoreId,
    ozonClientId: store.ozonClientId,
    apiKeyState: store.apiKeyEncrypted ? "API Key 已加密保存" : "API Key 未设置",
    createdAt: store.createdAt.toLocaleString()
  }));

  return (
    <AppShell title="店铺中心" eyebrow="Store Center" user={user}>
      {/* 铺品中心概览 */}
      <section className="dashboard-kpi-grid mb-6">
        <Link href="/products" className="dashboard-kpi-card">
          <div className="dashboard-kpi-head">
            <Rocket size={16} />
            <span>待铺品商品</span>
          </div>
          <div className="dashboard-kpi-value">
            <strong>{readyCount}</strong>
            <span>件</span>
          </div>
          <p>已优化 / 待发布，可铺到 Ozon</p>
        </Link>
        <Link href="/products" className="dashboard-kpi-card">
          <div className="dashboard-kpi-head">
            <PackageCheck size={16} />
            <span>已上架商品</span>
          </div>
          <div className="dashboard-kpi-value">
            <strong>{publishedCount}</strong>
            <span>件</span>
          </div>
          <p>已发布到 Ozon 店铺</p>
        </Link>
      </section>

      <OzonStoreConsole stores={consoleStores} />
    </AppShell>
  );
}
