import { PageSkeleton } from "@/components/Skeleton";

export default function ProductsLoading() {
  return (
    <div style={{ padding: "2rem", maxWidth: 1280, margin: "0 auto" }}>
      <PageSkeleton lines={5} />
    </div>
  );
}
