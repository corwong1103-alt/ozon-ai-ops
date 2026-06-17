import { AppShell } from "@/components/AppShell";

type UserForShell = {
  email: string;
  role: "user" | "admin";
  status: string;
  plan: string;
};

export function Source1688CollectorGuide({ user }: { user: UserForShell }) {
  return (
    <AppShell title="1688 采集" eyebrow="1688 Source Collector" user={user}>
      <section className="relative overflow-hidden rounded-[28px] border border-line bg-cotton p-5 shadow-sm">
        <div className="absolute right-0 top-0 h-36 w-36 border-l border-line bg-[linear-gradient(135deg,rgba(177,107,44,0.18),transparent)]" />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">真实商品图规则</p>
        <h3 className="mt-2 font-display text-4xl">1688 暂不展示替代图</h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-steel">
          你刚才这个要求是对的：1688 采集回来的图必须来自真实 1688 商品链接或 1688 授权 API。当前系统还没有接入真实 1688 数据源，所以这里不会再显示 mock 商品、Unsplash 图或 Ozon 图冒充 1688 图。
        </p>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="ledger-card p-5">
          <h3 className="font-display text-3xl">下一步接入方式</h3>
          <div className="mt-5 grid gap-3">
            <div className="readiness-card">
              <p className="text-sm font-bold text-ink">方式 A：真实 1688 商品链接采集</p>
              <p className="mt-2 text-sm leading-6 text-steel">
                你提供 1688 商品详情页链接，系统抓取页面内主图/标题/价格。能否自动抓取取决于 1688 登录态和反爬限制，稳定后再写入商品池。
              </p>
            </div>
            <div className="readiness-card">
              <p className="text-sm font-bold text-ink">方式 B：1688 / 阿里开放平台 API</p>
              <p className="mt-2 text-sm leading-6 text-steel">
                接入正式授权 API 后，商品标题、价格、SKU 和图片 URL 都从接口返回，适合后续外部测试和批量采集。
              </p>
            </div>
            <div className="readiness-card">
              <p className="text-sm font-bold text-ink">方式 C：手动入池，但必须填真实来源图</p>
              <p className="mt-2 text-sm leading-6 text-steel">
                如果先手工测试，可以到商品池新增商品，但图片 URL 必须是供应商商品页里的真实图片链接；系统不会再帮你补通用占位图。
              </p>
            </div>
          </div>
        </section>

        <section className="ledger-card p-5">
          <h3 className="font-display text-3xl">真实采集入口预留</h3>
          <p className="mt-2 text-sm leading-6 text-steel">
            这个输入框先作为接入位置展示。等你确认采用“链接采集”还是“开放平台 API”，我再把这里接成真实采集按钮。
          </p>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">1688 商品链接</span>
              <input className="field" placeholder="https://detail.1688.com/offer/..." disabled />
            </label>
            <button className="btn-primary w-full opacity-60" disabled>
              等待真实 1688 数据源接入
            </button>
          </div>
          <div className="mt-5 border border-line bg-rail p-4 text-sm leading-6 text-steel">
            验真标准：商品池里的 1688 图片必须能追溯到对应商品链接/API 返回值；如果抓不到图，就显示“无图/未接入”，不使用替代图。
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[28px] border border-line bg-rail/70 p-5">
        <h3 className="font-display text-3xl">现在能测什么</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="module-card">
            <p className="text-sm font-bold text-ink">能测</p>
            <p className="mt-2 text-sm leading-6 text-steel">Ozon 真实商品同步、商品池预览、VK/Wibus mock 发布、客服测试消息、任务记录。</p>
          </div>
          <div className="module-card">
            <p className="text-sm font-bold text-ink">待接</p>
            <p className="mt-2 text-sm leading-6 text-steel">1688 真实采集，需要商品链接抓取方案或开放平台/API 权限。</p>
          </div>
          <div className="module-card">
            <p className="text-sm font-bold text-ink">不做</p>
            <p className="mt-2 text-sm leading-6 text-steel">不再用普通图库、Ozon 图或本地 mock 图伪装成 1688 商品图。</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
