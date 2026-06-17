import { AppShell } from "@/components/AppShell";
import { ReliableProductImage } from "@/components/ReliableProductImage";
import { SocialAccountButton, SocialPostButtons } from "@/components/SocialActionControls";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { imageList } from "@/lib/product-images";

const platforms = [
  { id: "vk", label: "VK" },
  { id: "wibus", label: "Wibus" }
] as const;

export default async function SocialPage() {
  const user = await requireApprovedUser();
  const [accounts, products, posts] = await Promise.all([
    prisma.socialAccount.findMany({ where: { userId: user.id }, orderBy: { platform: "asc" } }),
    prisma.product.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.socialPost.findMany({
      where: { userId: user.id, platform: { in: ["vk", "wibus"] } },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  return (
    <AppShell title="社媒发布台" eyebrow="VK / Wibus" user={user}>
      <section className="mb-5 ledger-card p-5">
        <p className="text-xs font-bold text-accent">VK / Wibus 预览</p>
        <h3 className="mt-2 font-display text-4xl">每条社媒内容都必须先看到商品图</h3>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-steel">
          当前保留 VK 和 Wibus 两个平台。真实发布需要平台 OAuth/API；现在可测试授权状态、商品图预览、草稿任务和模拟图文发布。
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <section className="ledger-card p-5">
          <h3 className="font-display text-3xl">授权状态</h3>
          <p className="mt-2 text-sm leading-6 text-steel">当前只保留 VK 和 Wibus。现在可测试 mock 授权与发布记录；真实 VK 需要创建 VK 应用、OAuth 回调和访问令牌。</p>
          <div className="mt-4 space-y-3">
            {platforms.map((platform) => {
              const account = accounts.find((item) => item.platform === platform.id);
              return (
                <div key={platform.id} className="readiness-card">
                  <div className="flex justify-between">
                    <strong>{platform.label}</strong>
                    <span className="text-sm text-steel">{account?.status ?? "disconnected"}</span>
                  </div>
                  <p className="mt-1 text-sm text-steel">{account?.accountName ?? "未授权"}</p>
                  <div className="mt-3">
                    <SocialAccountButton platform={platform.id} connected={account?.status === "connected"} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ledger-card p-5">
          <h3 className="font-display text-3xl">社媒内容工作台</h3>
          <p className="mt-2 text-sm leading-6 text-steel">每条内容都带商品预览图。草稿生成需要大模型才能真实输出；模拟图文发布现在可直接测试；AI 视频发布最后测试。</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {products.map((product) => (
              <div key={product.id} className="overflow-hidden rounded-[22px] border border-line bg-cotton/80 shadow-sm">
                <div className="aspect-[16/9] bg-rail">
                  <ReliableProductImage images={imageList(product.images)} alt={product.title} className="h-full w-full object-cover" emptyLabel="暂无预览图" />
                </div>
                <div className="p-4">
                  <strong className="line-clamp-2 block">{product.title}</strong>
                  <p className="mt-2 text-sm text-steel">可生成标题、文案、Hashtag、图片素材和视频素材。</p>
                  <div className="mt-4 grid gap-2">
                    {platforms.map((platform) => (
                      <SocialPostButtons key={platform.id} productId={product.id} platform={platform.id} />
                    ))}
                  </div>
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
            <div key={post.id} className="grid gap-3 py-3 text-sm md:grid-cols-[96px_1fr]">
              <div className="aspect-square overflow-hidden border border-line bg-rail">
                <ReliableProductImage images={imageList(post.product.images)} alt={post.product.title} className="h-full w-full object-cover" />
              </div>
              <div>
                <strong>{post.platform.toUpperCase()}</strong>
                <span className="ml-3 text-steel">{post.mediaType} / {post.status}</span>
                <p className="mt-1 text-steel">{post.content}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
