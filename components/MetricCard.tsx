export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="ledger-card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-steel">{label}</p>
      <p className="mt-3 font-display text-4xl">{value}</p>
      <p className="mt-2 text-sm text-steel">{detail}</p>
    </div>
  );
}
