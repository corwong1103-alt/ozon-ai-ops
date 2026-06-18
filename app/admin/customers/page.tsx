import { AppShell } from "@/components/AppShell";
import { requireAdminUser } from "@/lib/auth";
import { maskSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { updateUserPlan, updateUserStatus } from "../actions";

export default async function AdminCustomersPage() {
  const user = await requireAdminUser();
  const users = await prisma.user.findMany({
    include: { credits: true, stores: true, socialAccounts: true, customerMessages: true },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return (
    <AppShell title="客户管理" eyebrow="Admin · Customers" user={user}>
      <div className="ledger-card overflow-hidden">
        <div className="grid grid-cols-12 border-b border-line bg-rail/45 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-steel">
          <span className="col-span-3">用户</span>
          <span className="col-span-2">状态</span>
          <span className="col-span-2">等级</span>
          <span className="col-span-2">AI额度</span>
          <span className="col-span-3 text-right">审核操作</span>
        </div>
        {users.map((item) => (
          <div key={item.id} className="grid grid-cols-12 gap-3 border-b border-line px-4 py-4 text-sm last:border-b-0">
            <div className="col-span-12 md:col-span-3">
              <strong>{item.email}</strong>
              <p className="mt-1 text-xs text-steel">
                店铺 {item.stores.length} / 社媒 {item.socialAccounts.length} / 客服 {item.customerMessages.length}
              </p>
            </div>
            <span className="col-span-4 text-steel md:col-span-2">{item.status}</span>
            <span className="col-span-4 text-steel md:col-span-2">{item.plan}</span>
            <span className="col-span-4 text-steel md:col-span-2">
              图 {item.credits?.imageCredits ?? 0} / 视频 {item.credits?.videoCredits ?? 0}
            </span>
            <div className="col-span-12 grid gap-3 md:col-span-3">
              <form action={updateUserStatus} className="flex justify-end gap-2">
                <input type="hidden" name="userId" value={item.id} />
                <button className="btn-secondary px-3 py-2 text-xs" name="status" value="approved">开通</button>
                <button className="btn-secondary px-3 py-2 text-xs" name="status" value="suspended">停用</button>
                <button className="btn-secondary px-3 py-2 text-xs" name="status" value="expired">过期</button>
              </form>
              <form action={updateUserPlan} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="userId" value={item.id} />
                <select className="field py-2 text-xs" name="plan" defaultValue={item.plan}>
                  <option value="starter">starter</option>
                  <option value="pro">pro</option>
                  <option value="vip">vip</option>
                </select>
                <input className="field py-2 text-xs" name="expiresAt" type="date" defaultValue={item.expiresAt?.toISOString().slice(0, 10) ?? ""} />
                <button className="btn-primary px-3 py-2 text-xs">保存</button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <section className="ledger-card mt-6 overflow-hidden">
        <div className="border-b border-line bg-rail/45 px-4 py-3">
          <h3 className="font-display text-3xl">用户店铺绑定</h3>
          <p className="mt-1 text-sm text-steel">管理员可查看店铺归属和凭证状态，但不明文显示 Ozon API Key。</p>
        </div>
        {users.flatMap((item) =>
          item.stores.map((store) => (
            <div key={store.id} className="grid grid-cols-12 gap-3 border-b border-line px-4 py-4 text-sm last:border-b-0">
              <strong className="col-span-12 md:col-span-3">{item.email}</strong>
              <span className="col-span-12 text-steel md:col-span-3">{store.name}</span>
              <span className="col-span-6 text-steel md:col-span-2">{store.ozonStoreId}</span>
              <span className="col-span-6 text-steel md:col-span-2">{store.ozonClientId}</span>
              <span className="col-span-12 text-steel md:col-span-2 md:text-right">{maskSecret(store.apiKeyEncrypted)}</span>
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
