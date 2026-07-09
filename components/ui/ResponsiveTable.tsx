// Thin breakpoint wrapper: desktop keeps a real <table>, mobile gets a
// caller-supplied card list. Deliberately doesn't try to derive cards from
// table markup — cell content (badges, inputs, actions) varies too much
// across call sites, so each caller builds its own card list.

export function ResponsiveTable({
  table,
  cards,
}: {
  table: React.ReactNode;
  cards: React.ReactNode;
}) {
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="md:hidden">{cards}</div>
    </>
  );
}

export function TableCard({
  title,
  titleExtra,
  fields,
  actions,
  tone,
}: {
  title: React.ReactNode;
  titleExtra?: React.ReactNode;
  fields: { label: string; value: React.ReactNode }[];
  actions?: React.ReactNode;
  tone?: 'default' | 'amber';
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--border-color)] p-4 space-y-2.5 ${
        tone === 'amber' ? 'bg-amber-500/5' : 'bg-[var(--bg-surface)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{title}</div>
        {titleExtra && <div className="shrink-0">{titleExtra}</div>}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {fields.map((f, i) => (
          <div key={i} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              {f.label}
            </dt>
            <dd className="text-sm text-[var(--text-secondary)] truncate">{f.value}</dd>
          </div>
        ))}
      </dl>
      {actions && (
        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)] mt-2.5">
          {actions}
        </div>
      )}
    </div>
  );
}
