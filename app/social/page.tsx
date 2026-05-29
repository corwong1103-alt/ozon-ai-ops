import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSocialCopy, publishSocialImage, publishSocialVideo, toggleSocialAccount } from "./actions";

export default async function SocialPage() {
  const user = await requireApprovedUser();
  const [accounts, products, posts] = await Promise.all([
    prisma.socialAccount.findMany({ where: { userId: user.id }, orderBy: { platform: "asc" } }),
    prisma.product.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.socialPost.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);

  return (
    <AppShell title="社媒发布" eyebrow="Social Publishing" user={user}>
      <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <section className="ledger-card p-5">
          <h3 className="font-display text-3xl">授权状态</h3>
          <div className="mt-4 space-y-3">
            {["tiktok", "instagram", "vk"].map((platform) => {
              const account = accounts.find((item) => item.platform === platform);
              return (
                <div key={platform} className="rounded-md border border-line bg-white/70 p-4">
                  <div className="flex justify-between">
                    <strong>{platform.toUpperCase()}</strong>
                    <span className="text-sm text-steel">{account?.status ?? "disconnected"}</span>
                  </div>
                  <p className="mt-1 text-sm text-steel">{account?.accountName ?? "未授权"}</p>
                  <form action={toggleSocialAccount.bind(null, platform)} className="mt-3">
                    <button className="btn-secondary w-full text-sm">{account?.status === "connected" ? "断开授权" : "模拟授权"}</button>
                  </form>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ledger-card p-5">
          <h3 className="font-display text-3xl">社媒内容工作台</h3>
          <p className="mt-2 text-sm leading-6 text-steel">图文发布不扣额度。生成 AI 视频会扣减 videoCredits。当前保留真实数据表和页面结构，第三方平台接口后续接入。</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {products.map((product) => (
              <div key={product.id} className="rounded-md border border-line bg-white/70 p-4">
                <strong>{product.title}</strong>
                <p className="mt-2 text-sm text-steel">可生成标题、文案、Hashtag、图片素材和视频素材。</p>
                <div className="mt-4 grid gap-2">
                  {["tiktok", "instagram", "vk"].map((platform) => (
                    <div key={platform} className="grid gap-2 md:grid-cols-3">
                      <form action={createSocialCopy}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="platform" value={platform} />
                        <button className="btn-secondary w-full px-2 py-2 text-xs">{platform} 文案</button>
                      </form>
                      <form action={publishSocialImage}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="platform" value={platform} />
                        <button className="btn-secondary w-full px-2 py-2 text-xs">图文发布</button>
                      </form>
                      <form action={publishSocialVideo}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="platform" value={platform} />
                        <button className="btn-primary w-full px-2 py-2 text-xs">AI视频发布</button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-sm text-steel">商品池为空，先添加商品后再生成社媒内容。</p>}
          </div>
        </section>
      </div>

      <section className="ledger-card mt-5 p-5">
        <h3 className="font-display text-3xl">发布记录</h3>
        <div className="mt-4 divide-y divide-line">
          {posts.length === 0 && <p className="text-sm text-steel">暂无发布记录。</p>}
          {posts.map((post) => (
            <div key={post.id} className="py-3 text-sm">
              <strong>{post.platform}</strong>
              <span className="ml-3 text-steel">{post.mediaType} / {post.status}</span>
              <p className="mt-1 text-steel">{post.content}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
