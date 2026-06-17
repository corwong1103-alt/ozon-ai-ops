export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="ledger-card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-steel">{label}</p>
      <p className="mt-3 font-display text-4xl leading-none text-ink">{value}</p>
      <p className="mt-3 text-sm leading-6 text-steel">{detail}</p>
    </div>
  );
}
