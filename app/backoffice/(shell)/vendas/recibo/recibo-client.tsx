"use client";

import { FileDown, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { downloadReciboPdf } from "@/lib/recibo-pdf-download";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { cn } from "@/lib/utils";

type VendaLista = {
  id: string;
  numero_venda: string;
  data_venda: string;
  valor_total: number | string;
  status: string;
  categoria_venda: string | null;
  destino: string | null;
  localizador: string | null;
  cliente?: { nome: string } | null;
};

function categoriaLabel(cat: string | null | undefined) {
  if (cat === "seguro_viagem") return "Seguro";
  if (cat === "servico") return "Serviço";
  return "Aéreo";
}

function categoriaBadge(cat: string | null | undefined) {
  if (cat === "seguro_viagem") return "info" as const;
  if (cat === "servico") return "warning" as const;
  return "default" as const;
}

export function ReciboClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [items, setItems] = useState<VendaLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("vendas")
        .select("id, numero_venda, data_venda, valor_total, status, categoria_venda, destino, localizador, cliente:clientes(nome)")
        .order("data_venda", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      if (profile?.tipo === "vendedor") {
        q = q.eq("vendedor_id", profile.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      setItems((data ?? []) as unknown as VendaLista[]);
    } catch (err) {
      toast.error("Erro ao carregar vendas", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.tipo]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((v) => {
      const nome = (v.cliente?.nome ?? "").toLowerCase();
      const num = (v.numero_venda ?? "").toLowerCase();
      const dest = (v.destino ?? "").toLowerCase();
      const loc = (v.localizador ?? "").toLowerCase();
      return nome.includes(term) || num.includes(term) || dest.includes(term) || loc.includes(term);
    });
  }, [items, search]);

  const selected = useMemo(
    () => filtered.find((v) => v.id === selectedId) ?? items.find((v) => v.id === selectedId) ?? null,
    [filtered, items, selectedId],
  );

  async function handleGerar() {
    if (!selected) {
      toast.error("Selecione uma venda para gerar o recibo.");
      return;
    }
    setGenerating(true);
    try {
      const filename = `Recibo-${selected.numero_venda || selected.id.slice(0, 8)}.pdf`;
      await downloadReciboPdf(selected.id, filename);
      toast.success("Recibo gerado com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar recibo");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <Topbar
        title="Recibo"
        subtitle="Gere o PDF do recibo a partir de uma venda"
        actions={
          <Button onClick={handleGerar} disabled={!selected || generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Gerar recibo
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        {selected && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Venda selecionada</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  #{selected.numero_venda} · {selected.cliente?.nome ?? "Sem cliente"}
                </p>
                <p className="text-[var(--text-secondary)]">
                  {formatDate(selected.data_venda)} · {formatCurrency(Number(selected.valor_total))} ·{" "}
                  {categoriaLabel(selected.categoria_venda)}
                  {selected.destino ? ` · ${selected.destino}` : ""}
                </p>
              </div>
              <Button onClick={handleGerar} disabled={generating} className="shrink-0">
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Gerar recibo
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Escolher venda</CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar número, cliente, destino..."
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--text-secondary)]">
                Nenhuma venda encontrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden md:table-cell">Categoria</TableHead>
                      <TableHead className="hidden lg:table-cell">Destino</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((v) => {
                      const active = selectedId === v.id;
                      return (
                        <TableRow
                          key={v.id}
                          role="button"
                          tabIndex={0}
                          aria-selected={active}
                          onClick={() => setSelectedId(v.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(v.id);
                            }
                          }}
                          className={cn(
                            "cursor-pointer",
                            active && "bg-[var(--accent-glow)]",
                          )}
                        >
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex h-4 w-4 items-center justify-center rounded-full border",
                                active
                                  ? "border-[var(--accent-600)] bg-[var(--accent-600)]"
                                  : "border-[var(--border-subtle)]",
                              )}
                              aria-hidden
                            >
                              {active && (
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                          <TableCell className="font-medium">
                            {v.cliente?.nome ?? "—"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={categoriaBadge(v.categoria_venda)}>
                              {categoriaLabel(v.categoria_venda)}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden max-w-[180px] truncate lg:table-cell">
                            {v.destino ?? "—"}
                          </TableCell>
                          <TableCell>{formatDate(v.data_venda)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(Number(v.valor_total))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
