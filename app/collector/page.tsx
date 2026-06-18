import { Source1688CollectorGuide } from "@/components/Source1688CollectorGuide";
import { requireApprovedUser } from "@/lib/auth";

export default async function CollectorPage() {
  const user = await requireApprovedUser();

  return (
    <Source1688CollectorGuide
      user={{
        email: user.email,
        role: user.role,
        status: user.status,
        plan: user.plan
      }}
    />
  );
}
