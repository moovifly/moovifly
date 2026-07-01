"use client";

import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FINANCE_PERIOD_PRESETS,
  addDays,
  daysBetween,
  type FinancePeriod,
  type FinancePeriodPreset,
} from "@/lib/financial/period";

type FinancePeriodFilterProps = {
  period: FinancePeriod;
  onChange: (period: FinancePeriod) => void;
  /** Limite de dias no período personalizado. Omitir = sem limite. */
  maxCustomDays?: number;
};

export function FinancePeriodFilter({ period, onChange, maxCustomDays }: FinancePeriodFilterProps) {
  function applyPreset(key: FinancePeriodPreset) {
    const preset = FINANCE_PERIOD_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const { from, to } = preset.range();
    onChange({ preset: key, start: from, end: to });
  }

  function handleDateFromChange(value: string) {
    let to = period.end;
    if (maxCustomDays && daysBetween(value, to) > maxCustomDays) {
      to = addDays(value, maxCustomDays);
      toast.info(`Período limitado a ${maxCustomDays} dias. Data final ajustada.`);
    }
    onChange({ preset: "personalizado", start: value, end: to });
  }

  function handleDateToChange(value: string) {
    if (maxCustomDays && daysBetween(period.start, value) > maxCustomDays) {
      toast.error(`O período personalizado não pode ultrapassar ${maxCustomDays} dias.`);
      onChange({ preset: "personalizado", start: period.start, end: addDays(period.start, maxCustomDays) });
      return;
    }
    onChange({ preset: "personalizado", start: period.start, end: value });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Período</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {FINANCE_PERIOD_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                period.preset === p.key
                  ? "border-(--color-primary) bg-(--color-primary) text-white"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>De</Label>
            <Input type="date" value={period.start} onChange={(e) => handleDateFromChange(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input
              type="date"
              value={period.end}
              min={period.start}
              max={maxCustomDays ? addDays(period.start, maxCustomDays) : undefined}
              onChange={(e) => handleDateToChange(e.target.value)}
            />
          </div>
          {maxCustomDays ? (
            <p className="pb-1 text-xs text-[var(--text-secondary)]">Máx. {maxCustomDays} dias no período personalizado</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
