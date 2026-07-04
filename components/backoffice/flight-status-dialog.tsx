"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plane, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { BackofficeLink } from "@/components/backoffice/backoffice-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FlightStatusEndpoint, FlightStatusResponse } from "@/lib/voos";

type FlightStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendaId: string | null;
  numeroVenda?: string;
  trechoIndex?: number;
};

/** Extrai data e hora "de parede" do aeroporto, sem converter para o fuso do navegador. */
function wallClock(value: string | null | undefined): { date: string; time: string } | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}

/** "2026-07-05" → "dom., 5 de jul." */
function formatCardDate(isoDate: string): string {
  const [y, mo, d] = isoDate.split("-").map(Number);
  if (!y || !mo || !d) return isoDate;
  return new Date(y, mo - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function durationLabel(dep: string | null, arr: string | null): string | null {
  if (!dep || !arr) return null;
  const start = Date.parse(dep);
  const end = Date.parse(arr);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  const mins = Math.round((end - start) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function relativeUpdated(fetchedAt: string | undefined): string | null {
  if (!fetchedAt) return null;
  const t = Date.parse(fetchedAt);
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `há ${h} h ${m} min` : `há ${h} h`;
}

function statusBadgeVariant(status: string | null): "success" | "warning" | "destructive" | "default" {
  switch (status?.toLowerCase()) {
    case "active":
    case "scheduled":
      return "success";
    case "delayed":
    case "cancelled":
    case "incident":
    case "diverted":
      return "destructive";
    default:
      return "default";
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  aerodatabox: "AeroDataBox",
  aviationstack: "Aviationstack",
};

function EndpointColumn({
  label,
  endpoint,
  cancelled,
}: {
  label: string;
  endpoint: FlightStatusEndpoint;
  cancelled: boolean;
}) {
  const scheduled = wallClock(endpoint.scheduled);
  const estimated = wallClock(endpoint.estimated ?? endpoint.actual);
  const changed = Boolean(scheduled && estimated && estimated.time !== scheduled.time);
  const late = changed && Boolean(endpoint.delay && endpoint.delay > 0);
  const place = endpoint.city || endpoint.airport || endpoint.iata || "—";
  const dateLabel = scheduled?.date ? formatCardDate(scheduled.date) : null;

  return (
    <div className="min-w-0 space-y-2.5">
      <p className="truncate text-sm font-medium">
        {place}
        {dateLabel && (
          <span className="font-normal text-[var(--text-secondary)]"> · {dateLabel}</span>
        )}
      </p>
      <div>
        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
        {changed && scheduled && estimated ? (
          <p className="text-2xl font-semibold tabular-nums leading-tight tracking-tight">
            <span className="mr-2 align-middle text-sm font-normal text-[var(--text-secondary)] line-through">
              {scheduled.time}
            </span>
            <span className={late ? "text-[var(--danger-text)]" : "text-[var(--success-text)]"}>
              {estimated.time}
            </span>
          </p>
        ) : (
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums leading-tight tracking-tight",
              cancelled ? "text-[var(--danger-text)] line-through" : "text-[var(--success-text)]",
            )}
          >
            {scheduled?.time ?? estimated?.time ?? "—"}
          </p>
        )}
      </div>
      <div className="flex gap-8">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Terminal</p>
          <p className="text-sm font-medium">{endpoint.terminal || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Portão</p>
          <p className="text-sm font-medium">{endpoint.gate || "—"}</p>
        </div>
      </div>
    </div>
  );
}

export function FlightStatusDialog({
  open,
  onOpenChange,
  vendaId,
  numeroVenda,
  trechoIndex = 0,
}: FlightStatusDialogProps) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<FlightStatusResponse | null>(null);
  const [selectedTrecho, setSelectedTrecho] = useState(trechoIndex);

  const loadStatus = useCallback(
    async (refresh = false) => {
      if (!vendaId) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          vendaId,
          trecho: String(selectedTrecho),
        });
        if (refresh) params.set("refresh", "1");
        const res = await fetch(`/api/flights/status?${params.toString()}`);
        const json = (await res.json()) as FlightStatusResponse & { error?: string };
        if (!res.ok) {
          if (json.found === false && json.message) {
            setData(json);
            return;
          }
          throw new Error(json.error ?? "Erro ao consultar status do voo.");
        }
        setData(json);
        if (refresh && json.cached === false) {
          toast.success("Status atualizado.");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao consultar status.";
        toast.error(msg);
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [vendaId, selectedTrecho],
  );

  useEffect(() => {
    if (open && vendaId) {
      setSelectedTrecho(trechoIndex);
    }
  }, [open, vendaId, trechoIndex]);

  useEffect(() => {
    if (open && vendaId) {
      loadStatus(false);
    } else if (!open) {
      setData(null);
    }
  }, [open, vendaId, selectedTrecho, loadStatus]);

  const idaVoos = data?.voos.filter((v) => v.tipo === "ida") ?? [];
  const cancelled = data?.flight_status?.toLowerCase() === "cancelled";
  const duration = data ? durationLabel(data.departure.scheduled, data.arrival.scheduled) : null;
  const updatedLabel = relativeUpdated(data?.fetched_at);
  const providerLabel = data?.provider ? PROVIDER_LABELS[data.provider] ?? data.provider : null;
  const flightLabel = data?.flight.iata ?? data?.trecho?.numero_voo ?? null;
  const airlineLabel = data?.airline.name || data?.trecho?.companhia || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-[var(--accent-600)]" />
            Status do voo
          </DialogTitle>
          <DialogDescription>
            {numeroVenda ? `Venda ${numeroVenda}` : "Consulta de status do voo"}
            {data?.venda.cliente_nome ? ` · ${data.venda.cliente_nome}` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando status...
          </div>
        ) : data ? (
          <div className="space-y-4">
            {data.venda.localizador && (
              <p className="text-sm">
                <span className="text-[var(--text-secondary)]">Localizador: </span>
                <span className="font-mono font-medium uppercase">{data.venda.localizador}</span>
              </p>
            )}

            {idaVoos.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {idaVoos.map((v, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    size="sm"
                    variant={selectedTrecho === idx ? "default" : "outline"}
                    onClick={() => setSelectedTrecho(idx)}
                  >
                    Trecho {idx + 1}
                    {v.numero_voo ? ` · ${v.numero_voo}` : ""}
                  </Button>
                ))}
              </div>
            )}

            {!data.found ? (
              <>
                {data.trecho && (
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-sm">
                    <p className="font-medium">
                      {data.trecho.origem || "—"} → {data.trecho.destino || "—"}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      {data.trecho.companhia || "—"}
                      {data.trecho.numero_voo ? ` · ${data.trecho.numero_voo}` : ""}
                      {data.trecho.data_partida ? ` · ${formatDate(data.trecho.data_partida)}` : ""}
                    </p>
                  </div>
                )}
                <div className="rounded-md border border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">
                  <p>{data.message ?? "Voo não encontrado."}</p>
                  <p className="mt-2">
                    <BackofficeLink href="/backoffice/vendas/" className="text-[var(--accent-600)] underline">
                      Editar venda
                    </BackofficeLink>{" "}
                    para cadastrar o número do voo.
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                {/* Companhia · voo + status */}
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-xs text-[var(--text-secondary)]">
                    {airlineLabel ?? "—"}
                    {flightLabel ? (
                      <span className="font-mono font-medium text-foreground"> · {flightLabel}</span>
                    ) : null}
                  </p>
                  <Badge
                    variant={statusBadgeVariant(data.flight_status)}
                    className="shrink-0 uppercase tracking-wide"
                  >
                    {data.flight_status_label ?? data.flight_status ?? "—"}
                  </Badge>
                </div>

                {/* Rota: BKO ——✈—— CMN */}
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-3xl font-semibold leading-none tracking-tight">
                    {data.departure.iata || "—"}
                  </span>
                  <div className="flex-1 pb-1">
                    {duration && (
                      <p className="mb-1.5 text-center text-[11px] leading-none text-[var(--text-secondary)]">
                        {duration}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-[var(--accent-400)]" />
                      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                      <Plane className="h-4 w-4 shrink-0 rotate-45 text-[var(--accent-400)]" />
                      <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-400)]" />
                    </div>
                  </div>
                  <span className="text-3xl font-semibold leading-none tracking-tight">
                    {data.arrival.iata || "—"}
                  </span>
                </div>

                {/* Partida | Chegada */}
                <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-2">
                  <EndpointColumn label="Partida programada" endpoint={data.departure} cancelled={cancelled} />
                  <div className="border-t border-[var(--border-subtle)] pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                    <EndpointColumn label="Chegada programada" endpoint={data.arrival} cancelled={cancelled} />
                  </div>
                </div>

                {/* Rodapé do card */}
                {(updatedLabel || providerLabel) && (
                  <p className="mt-4 border-t border-[var(--border-subtle)] pt-2.5 text-[11px] text-[var(--text-secondary)]">
                    {updatedLabel ? `Atualizado ${updatedLabel}` : null}
                    {updatedLabel && providerLabel ? " · " : null}
                    {providerLabel ? `Fonte: ${providerLabel}` : null}
                    {data.cached ? " · cache" : null}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-[var(--text-secondary)]">

          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || refreshing || !vendaId}
              onClick={() => loadStatus(true)}
              title="Força nova consulta na API de voos (consome cota)"
            >
              <RefreshCw className={`mr-1 h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
