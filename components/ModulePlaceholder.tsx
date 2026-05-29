export function ModulePlaceholder({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <section className="ledger-card p-5 md:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Module Framework</p>
      <h3 className="mt-2 font-display text-3xl">{title}</h3>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-steel">{description}</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="rounded-md border border-line bg-white/70 p-4 text-sm font-semibold text-ink">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
