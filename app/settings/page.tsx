import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";

export default async function SellerSettingsPage() {
  const user = await requireApprovedUser();

  return (
    <AppShell title="设置" eyebrow="卖家偏好与工作流设置" user={user}>
      <section className="seller-page">
        <div className="seller-page-header">
          <div>
            <span className="section-kicker">Settings</span>
            <h2>先保留必要设置</h2>
            <p>V6 Seller 端只展示卖家需要理解的设置。底层模型、任务和接口配置继续隐藏在系统内部。</p>
          </div>
          <Link href="/stores" className="btn-primary">管理店铺</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="ledger-card p-5">
            <h3 className="text-base font-semibold text-earth">发布偏好</h3>
            <p className="mt-2 text-sm leading-6 text-steel">默认发布前需要人工确认。真实 Ozon 上传仍受后端 dry-run 与店铺配置保护。</p>
          </section>
          <section className="ledger-card p-5">
            <h3 className="text-base font-semibold text-earth">AI Workspace</h3>
            <p className="mt-2 text-sm leading-6 text-steel">标题、描述、图片、属性、SEO 和价格建议统一从商品制作页进入。</p>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
