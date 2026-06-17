import { PageSkeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div style={{ padding: "2rem", maxWidth: 1280, margin: "0 auto" }}>
      <PageSkeleton lines={6} />
    </div>
  );
}
