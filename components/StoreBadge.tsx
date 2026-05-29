export function StoreBadge({ label = "Ozon 跨境店铺" }: { label?: string }) {
  return <span className="inline-flex items-center rounded-md border border-accent/25 bg-accent/10 px-2 py-1 text-xs font-bold text-accent">{label}</span>;
}
