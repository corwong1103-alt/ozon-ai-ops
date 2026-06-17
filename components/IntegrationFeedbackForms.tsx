"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, TestTube2 } from "lucide-react";
import { saveIntegration, testDashscopeIntegration } from "@/app/integrations/actions";
import { useToast } from "@/components/Toast";

type IntegrationField = {
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
};

export function IntegrationConfigForm({
  provider,
  shortName,
  secretLabel,
  secretPlaceholder,
  hasSecret,
  accountLabel,
  fields,
  publicConfig
}: {
  provider: string;
  shortName: string;
  secretLabel: string;
  secretPlaceholder: string;
  hasSecret: boolean;
  accountLabel: string;
  fields: IntegrationField[];
  publicConfig: Record<string, string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="integration-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = formRef.current;
        if (!form) return;

        startTransition(async () => {
          try {
            const result = await saveIntegration(provider, new FormData(form));
            if (result?.ok) {
              toast("success", result.message || `${shortName} 配置已保存。`);
              form.reset();
              router.refresh();
              return;
            }
            toast("error", result?.message || `${shortName} 配置保存失败。`);
          } catch (error) {
            toast("error", error instanceof Error ? error.message : `${shortName} 配置保存失败。`);
          }
        });
      }}
    >
      <label>
        <span>账号/用途备注</span>
        <input className="field" name="accountLabel" placeholder={`${shortName} 测试账号`} defaultValue={accountLabel} />
      </label>

      <label>
        <span>{secretLabel}</span>
        <input className="field" name="secret" type="password" placeholder={hasSecret ? "已加密保存；不修改可留空" : secretPlaceholder} />
      </label>

      <div className="integration-fields">
        {fields.map((field) => (
          <label key={field.name}>
            <span>
              {field.label}
              {field.required && <b>必填</b>}
            </span>
            <input className="field" name={field.name} placeholder={field.placeholder} defaultValue={publicConfig[field.name] || ""} />
          </label>
        ))}
      </div>

      <button className="btn-primary" disabled={pending}>
        <CheckCircle2 size={16} />
        {pending ? "保存中…" : `保存 ${shortName} 配置`}
      </button>
    </form>
  );
}

export function DashscopeTestForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="integration-test-row"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            const result = await testDashscopeIntegration();
            if (result?.ok) {
              toast("success", result.message || "百炼 API 连通性测试通过。");
              router.refresh();
              return;
            }
            toast("error", result?.message || "百炼 API 连通性测试失败。");
            router.refresh();
          } catch (error) {
            toast("error", error instanceof Error ? error.message : "百炼 API 连通性测试失败。");
          }
        });
      }}
    >
      <button className="btn-secondary" disabled={pending}>
        <TestTube2 size={16} />
        {pending ? "测试中…" : "保存后测试百炼文本模型"}
      </button>
    </form>
  );
}
