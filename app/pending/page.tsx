import { AccountStatePage } from "@/components/AccountStatePage";
import { requireUser } from "@/lib/auth";

export default async function PendingPage() {
  await requireUser();

  return <AccountStatePage title="账号审核中" description="请联系管理员完成开通。审核通过后，才能进入 Ozon AI 跨境运营后台。" />;
}
