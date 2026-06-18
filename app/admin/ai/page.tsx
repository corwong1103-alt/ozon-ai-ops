import { Bot } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminAiPage() {
  const user = await requireAdminUser();

  const [textCalls, imageCalls, videoCalls, textFailed, imageFailed] = await Promise.all([
    prisma.taskLog.count({ where: { type: { in: ["translate", "customer_message", "auto_reply"] } } }),
    prisma.taskLog.count({ where: { type: "image" } }),
    prisma.taskLog.count({ where: { type: "video" } }),
    prisma.taskLog.count({ where: { type: { in: ["translate", "customer_message"] }, status: "failed" } }),
    prisma.taskLog.count({ where: { type: "image", status: "failed" } })
  ]);

  const models = [
    { name: "Qwen 文本", model: "qwen3.7-plus / qwen3.6-flash", calls: textCalls, failed: textFailed, status: "已接入" },
    { name: "Qwen 图片", model: "qwen-image-2.0-pro", calls: imageCalls, failed: imageFailed, status: "已接入" },
    { name: "视频模型", model: "wan2.7-t2v", calls: videoCalls, failed: 0, status: "筹备中" }
  ];

  return (
    <AppShell title="AI 中心" eyebrow="Admin · AI" user={user}>
      <section className="dashboard-board">
        <div className="dashboard-topline">
          <div>
            <p className="section-kicker">AI 模型管理</p>
            <h3>Qwen 文本 / 图片 / 视频模型的调用量、消耗与失败率监控。</h3>
          </div>
        </div>
        <div className="dashboard-kpi-grid">
          {models.map((m) => (
            <div key={m.name} className="dashboard-kpi-card">
              <div className="dashboard-kpi-head"><Bot size={16} /><span>{m.name}</span></div>
              <p className="text-xs text-steel">{m.model}</p>
              <div className="dashboard-kpi-value"><strong>{m.status}</strong></div>
              <p className="text-xs text-steel">调用 {m.calls} · 失败 {m.failed}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-steel">DashScope 已接入。视频模型端点确认中。V3 P4 阶段统一 AI 工作台。</p>
      </section>
    </AppShell>
  );
}
