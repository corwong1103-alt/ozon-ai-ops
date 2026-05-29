import { AccountStatePage } from "@/components/AccountStatePage";
import { requireUser } from "@/lib/auth";

export default async function ExpiredPage() {
  await requireUser();

  return <AccountStatePage title="账号已过期" description="请联系管理员续期后继续使用平台。" tone="blocked" />;
}
