import { AppShell } from "@/components/AppShell";
import { AiStudioClient } from "@/components/AiStudioClient";
import { requireApprovedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AiStudioPage() {
  const user = await requireApprovedUser();
  const [products, imageCredits, videoCredits] = await Promise.all([
    prisma.product.findMany({
      where: { userId: user.id },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 50
    }),
    Promise.resolve(user.credits?.imageCredits ?? 0),
    Promise.resolve(user.credits?.videoCredits ?? 0)
  ]);

  return (
    <AppShell title="AI 工作台" eyebrow="AI Studio" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">统一 AI 能力中心</p>
            <h3>商品 AI · 素材 AI · 视频 AI · 社媒 AI 四类能力统一入口。</h3>
          </div>
          <div className="dashboard-user-strip">
            <span>图片额度 {imageCredits}</span>
            <span>视频额度 {videoCredits}</span>
          </div>
        </div>

        <AiStudioClient
          products={products}
          imageCredits={imageCredits}
          videoCredits={videoCredits}
        />
      </section>
    </AppShell>
  );
}
