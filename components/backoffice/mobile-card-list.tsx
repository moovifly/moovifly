import type { ReactNode } from "react";

/** Linha da lista mobile (espelha uma linha da tabela desktop, sem perder ações). */
export type MobileCardRow = {
  key: string;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: string;
  details?: Array<{ label: string; value: ReactNode }>;
  badge?: ReactNode;
  actions?: ReactNode;
};

/** Lista de cards exibida no lugar das tabelas em telas < md. */
export function MobileCardList({ rows }: { rows: MobileCardRow[] }) {
  return (
    <ul className="space-y-3 md:hidden">
      {rows.map((row) => (
        <li key={row.key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
              {row.subtitle && (
                <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{row.subtitle}</p>
              )}
            </div>
            {row.badge && <div className="shrink-0">{row.badge}</div>}
          </div>
          {row.value && (
            <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">{row.value}</p>
          )}
          {row.details && row.details.length > 0 && (
            <dl className={row.value ? "mt-1.5 space-y-1" : "mt-2 space-y-1"}>
              {row.details.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-3 text-xs">
                  <dt className="text-[var(--text-secondary)]">{d.label}</dt>
                  <dd className="text-right text-foreground">{d.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {row.actions && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
              {row.actions}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
