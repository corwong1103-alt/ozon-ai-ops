import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { SELLER_WORKFLOW_STEPS } from "@/lib/product-lifecycle";

export default async function HelpPage() {
  const user = await requireApprovedUser();

  return (
    <AppShell title="帮助中心" eyebrow="四步完成一次上架" user={user}>
      <section className="seller-page">
        <div className="seller-page-header">
          <div>
            <span className="section-kicker">Guide</span>
            <h2>只记住四件事</h2>
            <p>发现商品、制作商品、确认商品、发布商品。其它系统细节都会被折叠在对应页面里。</p>
          </div>
          <Link href="/research" className="btn-primary">开始发现商品</Link>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {SELLER_WORKFLOW_STEPS.map((step, index) => (
            <section key={step.label} className="ledger-card p-4">
              <span className="status-chip">STEP {index + 1}</span>
              <h3 className="mt-4 text-base font-semibold text-earth">{step.label}</h3>
              <p className="mt-2 text-sm leading-6 text-steel">{step.description}</p>
            </section>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
