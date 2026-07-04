"use client";

import { useEffect, useMemo, useState } from "react";
import { PlaneTakeoff } from "lucide-react";

import { FlightStatusDialog } from "@/components/backoffice/flight-status-dialog";
import { EmptyState } from "@/components/backoffice/empty-state";
import { Topbar } from "@/components/backoffice/topbar";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { diffDaysFromToday, embarqueAlertTitle, parseDateOnlyToLocal, startOfLocalDay } from "@/lib/embarques";
import { getIdaVoos, parseVoosFromObservacoes, parseVoosJson, type Voo } from "@/lib/voos";

type EmbarqueItem = {
  id: string;
  numero_venda: string;
  origem: string | null;
  destino: string | null;
  localizador: string | null;
  status: string;
  data_ida: string | null;
  observacoes?: string | null;
  voos?: Voo[] | unknown;
  clientes?: { nome: string } | { nome: string }[] | null;
  usuarios?: { nome: string } | { nome: string }[] | null;
};

function relNome(rel: EmbarqueItem["clientes"]): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.nome;
  return rel.nome;
}

function relVendedor(rel: EmbarqueItem["usuarios"]): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.nome;
  return rel.nome;
}

function resolveEmbarqueVoos(item: EmbarqueItem): Voo[] {
  const parsed = parseVoosJson(item.voos);
  if (parsed.length) return parsed;
  return parseVoosFromObservacoes(item.observacoes);
}

function primeiroNumeroVoo(item: EmbarqueItem): string {
  const idas = getIdaVoos(resolveEmbarqueVoos(item));
  return idas[0]?.numero_voo?.trim() || "—";
}

export function EmbarquesClient() {
  const { profile } = useAuth();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [tab, setTab] = useState<"proximos" | "realizados">("proximos");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EmbarqueItem[]>([]);
  const [selectedVenda, setSelectedVenda] = useState<EmbarqueItem | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const p = profile;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let q = supabase
          .from("vendas")
          .select("id, numero_venda, origem, destino, localizador, observacoes, status, data_ida, voos, clientes(nome), usuarios(nome)")
          .in("status", ["confirmada", "concluida"])
          .not("data_ida", "is", null)
          .order("data_ida", { ascending: true });
        if (p.tipo === "vendedor") q = q.eq("vendedor_id", p.id);
        const { data, error } = await q;
        if (error) throw error;
        if (!cancelled) setItems((data ?? []) as unknown as EmbarqueItem[]);
      } catch (err) {
        console.error("[embarques] erro:", err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profile, supabase]);

  const { proximos, realizados } = useMemo(() => {
    const now = new Date();
    const today = startOfLocalDay(now).getTime();
    const withDate = items
      .filter((i) => !!i.data_ida)
      .map((i) => ({
        ...i,
        _embarqueTs: startOfLocalDay(parseDateOnlyToLocal(i.data_ida as string)).getTime(),
        _diffDays: diffDaysFromToday(i.data_ida as string, now),
      }))
      .sort((a, b) => a._embarqueTs - b._embarqueTs);

    return {
      proximos: withDate.filter((i) => i._embarqueTs >= today),
      realizados: withDate.filter((i) => i._embarqueTs < today).sort((a, b) => b._embarqueTs - a._embarqueTs),
    };
  }, [items]);

  const list = tab === "proximos" ? proximos : realizados;

  function openFlightStatus(item: EmbarqueItem) {
    setSelectedVenda(item);
    setStatusOpen(true);
  }

  return (
    <>
      <Topbar
        title="Embarques"
        subtitle={
          loading
            ? "Carregando..."
            : tab === "proximos"
              ? `${proximos.length} próximo(s)`
              : `${realizados.length} realizado(s)`
        }
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <PlaneTakeoff className="h-4 w-4 text-[var(--accent-600)]" />
              <CardTitle>Agenda de embarques</CardTitle>
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="proximos">Próximos</TabsTrigger>
                <TabsTrigger value="realizados">Já feitos</TabsTrigger>
              </TabsList>
              <TabsContent value="proximos" />
              <TabsContent value="realizados" />
            </Tabs>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={PlaneTakeoff}
                title={tab === "proximos" ? "Nenhum embarque próximo" : "Nenhum embarque realizado"}
                description="Vendas confirmadas com data de ida aparecem aqui. Clique em um embarque para ver o status do voo."
              />
            ) : (
              <>
              {/* Lista mobile: cards clicáveis (mesma ação da linha da tabela) */}
              <div className="space-y-3 md:hidden">
                {list.map((i) => {
                  const nome = relNome(i.clientes) ?? "—";
                  const vendedor = relVendedor(i.usuarios) ?? "—";
                  const diff = i.data_ida ? i._diffDays : null;
                  const badge =
                    diff === null
                      ? null
                      : diff === 0
                        ? { text: "Hoje", variant: "success" as const }
                        : diff > 0
                          ? { text: embarqueAlertTitle(diff), variant: "warning" as const }
                          : { text: "Realizado", variant: "default" as const };

                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => openFlightStatus(i)}
                      title="Toque para ver status do voo"
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-left transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{nome}</p>
                          <p className="font-mono text-xs text-[var(--text-secondary)]">#{i.numero_venda}</p>
                        </div>
                        {badge ? <Badge variant={badge.variant} className="shrink-0">{badge.text}</Badge> : null}
                      </div>
                      <p className="mt-2 truncate text-sm text-[var(--text-secondary)]">
                        {i.origem ?? "—"} → {i.destino ?? "—"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                        <span>{i.data_ida ? formatDate(i.data_ida) : "—"}</span>
                        <span className="font-mono uppercase">Voo {primeiroNumeroVoo(i)}</span>
                        {i.localizador?.trim() && (
                          <span className="font-mono uppercase">LOC {i.localizador.trim()}</span>
                        )}
                        {profile?.tipo !== "vendedor" && <span className="min-w-0 truncate">{vendedor}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Tabela (md+) */}
              <div className="hidden md:block">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Voo</TableHead>
                    <TableHead className="hidden lg:table-cell">Localizador</TableHead>
                    <TableHead>Embarque</TableHead>
                    {profile?.tipo !== "vendedor" && <TableHead>Vendedor</TableHead>}
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((i) => {
                    const nome = relNome(i.clientes) ?? "—";
                    const vendedor = relVendedor(i.usuarios) ?? "—";
                    const diff = i.data_ida ? i._diffDays : null;
                    const badge =
                      diff === null
                        ? null
                        : diff === 0
                          ? { text: "Hoje", variant: "success" as const }
                          : diff > 0
                            ? { text: embarqueAlertTitle(diff), variant: "warning" as const }
                            : { text: "Realizado", variant: "default" as const };

                    return (
                      <TableRow
                        key={i.id}
                        className="cursor-pointer hover:bg-[var(--bg-elevated)]"
                        onClick={() => openFlightStatus(i)}
                        title="Clique para ver status do voo"
                      >
                        <TableCell className="font-mono text-xs">{i.numero_venda}</TableCell>
                        <TableCell className="font-medium">{nome}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{i.origem ?? "—"}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{i.destino ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs uppercase">{primeiroNumeroVoo(i)}</TableCell>
                        <TableCell className="hidden font-mono text-xs uppercase lg:table-cell">{i.localizador?.trim() || "—"}</TableCell>
                        <TableCell>{i.data_ida ? formatDate(i.data_ida) : "—"}</TableCell>
                        {profile?.tipo !== "vendedor" && <TableCell>{vendedor}</TableCell>}
                        <TableCell className="text-right">
                          {badge ? <Badge variant={badge.variant}>{badge.text}</Badge> : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <FlightStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        vendaId={selectedVenda?.id ?? null}
        numeroVenda={selectedVenda?.numero_venda}
      />
    </>
  );
}
