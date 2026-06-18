import Link from "next/link";
import { Megaphone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { advanceContentStatus, createContentFromProduct, publishContentNow, scheduleContent } from "./actions";

const statusLabel: Record<string, string> = {
  draft: "草稿",
  pending_review: "待审核",
  ready: "待发布",
  published: "已发布",
  scheduled: "定时发布",
  failed: "失败"
};

function formatTime(date: Date | null) {
  if (!date) return "";
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function ContentCenterPage() {
  const user = await requireApprovedUser();
  const [posts, products, draftCount, publishedCount] = await Promise.all([
    prisma.socialPost.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { product: true }
    }),
    prisma.product.findMany({
      where: { userId: user.id },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 50
    }),
    prisma.socialPost.count({ where: { userId: user.id, status: { in: ["draft", "pending_review", "ready"] } } }),
    prisma.socialPost.count({ where: { userId: user.id, status: "published" } })
  ]);

  return (
    <AppShell title="内容中心" eyebrow="Content Center" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">来自商品中心的营销内容</p>
            <h3>商品 → AI 生成 → 审核 → 发布。内容必须来自商品中心。</h3>
          </div>
          <div className="dashboard-user-strip">
            <span>待推广 {draftCount}</span>
            <span>已发布 {publishedCount}</span>
          </div>
        </div>

        {/* 创建内容表单 */}
        <section className="ledger-card mt-4 p-5">
          <h3 className="font-display text-2xl mb-3">从商品创建内容</h3>
          {products.length === 0 ? (
            <p className="text-sm text-steel">请先到商品中心添加商品。</p>
          ) : (
            <form action={createContentFromProduct} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <select name="productId" className="field" defaultValue={products[0]?.id}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.title.slice(0, 40)}</option>
                ))}
              </select>
              <select name="platform" className="field" defaultValue="vk">
                <option value="vk">VK</option>
                <option value="wibus" disabled>Wibes（筹备中）</option>
              </select>
              <select name="topic" className="field" defaultValue="caption">
                <option value="title">标题</option>
                <option value="caption">文案</option>
                <option value="tags">标签</option>
              </select>
              <button className="btn-primary">AI 生成</button>
            </form>
          )}
        </section>

        {/* 内容列表 + 状态流转 */}
        <section className="ledger-card mt-5 overflow-hidden">
          <div className="border-b border-line bg-rail/45 px-4 py-3">
            <h3 className="font-display text-2xl">内容列表</h3>
            <p className="mt-1 text-xs text-steel">5 阶段状态机：草稿 → 待审核 → 待发布 → 已发布 / 定时发布</p>
          </div>
          {posts.length === 0 && <p className="px-4 py-6 text-sm text-steel">暂无内容。从上方选择商品创建。</p>}
          {posts.map((post) => (
            <div key={post.id} className="border-b border-line px-4 py-4 last:border-b-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="status-chip">{statusLabel[post.status] || post.status}</span>
                <strong className="text-sm">{post.platform.toUpperCase()}</strong>
                <span className="text-xs text-steel">商品：{post.product?.title?.slice(0, 30) || "已删除"}</span>
                {post.scheduledAt && <span className="text-xs text-steel">定时：{formatTime(post.scheduledAt)}</span>}
                {post.publishedAt && <span className="text-xs text-green-600">已发布：{formatTime(post.publishedAt)}</span>}
              </div>
              <p className="mt-2 text-sm text-ink line-clamp-3">{post.content}</p>

              {/* 状态流转操作 */}
              <div className="mt-3 flex flex-wrap gap-2">
                {post.status === "draft" && (
                  <form action={advanceContentStatus}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="action" value="review" />
                    <button className="btn-secondary px-3 py-1 text-xs">提交审核</button>
                  </form>
                )}
                {post.status === "pending_review" && (
                  <>
                    <form action={advanceContentStatus}>
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="action" value="approve" />
                      <button className="btn-primary px-3 py-1 text-xs">批准发布</button>
                    </form>
                    <form action={advanceContentStatus}>
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="hidden" name="action" value="reject" />
                      <button className="btn-secondary px-3 py-1 text-xs">退回草稿</button>
                    </form>
                  </>
                )}
                {post.status === "ready" && (
                  <>
                    <form action={publishContentNow}>
                      <input type="hidden" name="postId" value={post.id} />
                      <button className="btn-primary px-3 py-1 text-xs">立即发布 VK</button>
                    </form>
                    <form action={scheduleContent} className="flex items-center gap-1">
                      <input type="hidden" name="postId" value={post.id} />
                      <input type="datetime-local" name="scheduledAt" className="field py-1 text-xs" />
                      <button className="btn-secondary px-3 py-1 text-xs">定时</button>
                    </form>
                  </>
                )}
                {post.status === "scheduled" && (
                  <form action={advanceContentStatus}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="action" value="approve" />
                    <button className="btn-secondary px-3 py-1 text-xs">改回待发布</button>
                  </form>
                )}
                {post.status === "failed" && (
                  <form action={advanceContentStatus}>
                    <input type="hidden" name="postId" value={post.id} />
                    <input type="hidden" name="action" value="review" />
                    <button className="btn-secondary px-3 py-1 text-xs">重新提交</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </section>
        <p className="mt-6 text-xs text-steel">
          <Megaphone size={12} className="inline mr-1" />
          VK 发布默认 dry-run（不真实发送）。设置 VK_REAL_PUBLISH=true 开启真实发布。Wibes 筹备中。
        </p>
      </section>
    </AppShell>
  );
}
