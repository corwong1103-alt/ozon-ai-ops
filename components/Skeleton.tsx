export function SkeletonCard({ height = 160 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: 12,
        border: "1px solid rgb(var(--clay) / 0.5)",
        background: `linear-gradient(110deg, rgb(var(--sand) / 0.4) 30%, rgb(var(--parchment) / 0.7) 50%, rgb(var(--sand) / 0.4) 70%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite"
      }}
    />
  );
}

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return (
    <div
      style={{
        width,
        height: 16,
        borderRadius: 6,
        background: `linear-gradient(110deg, rgb(var(--clay) / 0.3) 30%, rgb(var(--sand) / 0.6) 50%, rgb(var(--clay) / 0.3) 70%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite"
      }}
    />
  );
}

export function PageSkeleton({ lines = 8 }: { lines?: number }) {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <SkeletonLine width="30%" />
        <SkeletonLine width="60%" />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem"
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} height={200} />
        ))}
      </div>
      <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine key={i} width={`${70 + Math.random() * 30}%`} />
        ))}
      </div>
    </div>
  );
}
