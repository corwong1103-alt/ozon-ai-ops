import { KeyRound, Link2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DashscopeTestForm, IntegrationConfigForm, OzonMarketTestForm } from "@/components/IntegrationFeedbackForms";
import { requireApprovedUser } from "@/lib/auth";
import { integrationDefinitions, readPublicConfig } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";

function statusLabel(status?: string, hasSecret?: boolean) {
  if (status === "error") return "需检查";
  if (hasSecret) return "已保存";
  return "待填写";
}

function statusClass(status?: string, hasSecret?: boolean) {
  if (status === "error") return "error";
  if (hasSecret) return "ready";
  return "waiting";
}

export default async function IntegrationsPage() {
  const user = await requireApprovedUser();
  const integrations = await prisma.apiIntegration.findMany({
    where: { userId: user.id }
  });
  const integrationMap = new Map(integrations.map((item) => [item.provider, item]));
  const configuredCount = integrations.filter((item) => Boolean(item.secretEncrypted)).length;

  return (
    <AppShell title="API 接入中心" eyebrow="Integration Center" user={user}>
      <section className="integration-hero">
        <div>
          <p className="section-kicker">真实 API 填写入口</p>
          <h3>把需要的 Key 都放到这里，后面测试就不再翻环境变量。</h3>
          <p>
            Ozon 店铺继续在“店铺”页绑定；Ozon 市场数据源、百炼、1688、VK 和 Wibus 在这里统一保存。密钥会加密入库，页面只显示是否已保存。
          </p>
        </div>
        <div className="integration-hero-meter">
          <strong>{configuredCount}/{integrationDefinitions.length}</strong>
          <span>已保存密钥</span>
        </div>
      </section>

      <div className="integration-grid">
        {integrationDefinitions.map((definition) => {
          const integration = integrationMap.get(definition.provider);
          const publicConfig = readPublicConfig(integration?.publicConfig);
          const hasSecret = Boolean(integration?.secretEncrypted);

          return (
            <section key={definition.provider} className="integration-card">
              <div className="integration-card-head">
                <div className="integration-icon">
                  <KeyRound size={18} />
                </div>
                <div>
                  <p>{definition.shortName}</p>
                  <h3>{definition.name}</h3>
                </div>
                <span className={`integration-status ${statusClass(integration?.status, hasSecret)}`}>
                  {statusLabel(integration?.status, hasSecret)}
                </span>
              </div>

              <p className="integration-desc">{definition.description}</p>
              <div className="integration-guide">
                <ShieldCheck size={15} />
                <span>{definition.help}</span>
              </div>

              <IntegrationConfigForm
                provider={definition.provider}
                shortName={definition.shortName}
                secretLabel={definition.secretLabel}
                secretPlaceholder={definition.secretPlaceholder}
                hasSecret={hasSecret}
                accountLabel={integration?.accountLabel || ""}
                fields={definition.fields}
                publicConfig={publicConfig}
              />

              {definition.provider === "dashscope" && <DashscopeTestForm />}
              {definition.provider === "ozon_market" && <OzonMarketTestForm />}

              <div className="integration-foot">
                <span>
                  <Link2 size={13} />
                  {hasSecret ? "密钥已保存" : "未保存密钥"}
                </span>
                <span>{integration?.lastCheckedAt ? integration.lastCheckedAt.toLocaleString("zh-CN") : "尚未测试"}</span>
              </div>
              {integration?.lastMessage && <p className="integration-message">{integration.lastMessage}</p>}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
