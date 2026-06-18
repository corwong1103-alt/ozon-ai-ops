import { requireApprovedUser } from "@/lib/auth";
import { ResearchShell } from "@/components/ResearchShell";
import { Research1688Console } from "@/components/Research1688Console";

export default async function Research1688Page() {
  const user = await requireApprovedUser();
  return (
    <ResearchShell user={{ email: user.email, role: user.role, status: user.status, plan: user.plan }}>
      <Research1688Console />
    </ResearchShell>
  );
}
