import { AppShell } from "@/components/AppShell";
import { NewStoreForm } from "@/components/NewStoreForm";
import { requireApprovedUser } from "@/lib/auth";

export default async function NewStorePage() {
  const user = await requireApprovedUser();

  return (
    <AppShell title="绑定店铺" eyebrow="Store Setup" user={user}>
      <NewStoreForm />
    </AppShell>
  );
}
