import { AccountStatePage } from "@/components/AccountStatePage";
import { requireUser } from "@/lib/auth";

export default async function SuspendedPage() {
  await requireUser();

  return <AccountStatePage title="账号已停用" description="该账号当前无法访问后台，请联系管理员处理。" tone="blocked" />;
}
