"use client";

import { CreditCard, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/backoffice/empty-state";
import { MobileCardList } from "@/components/backoffice/mobile-card-list";
import { Topbar } from "@/components/backoffice/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getSupabaseClient, getSupabasePublicUrl } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { formatCurrency, formatDateTime } from "@/lib/format";

type Pagamento = {
  id: string;
  venda_id: string | null;
  valor: number | string;
  status: string;
  checkout_url: string | null;
  created_at: string;
  vendas?: { numero_venda: string; destino: string | null } | { numero_venda: string; destino: string | null }[] | null;
};

type Venda = { id: string; numero_venda: string; destino: string | null; valor_total: number | string };

export function CheckoutClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const searchParams = useSearchParams();
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loadingPag, setLoadingPag] = useState(true);
  const [selectedVenda, setSelectedVenda] = useState("");
  const [criando, setCriando] = useState(false);

  async function loadPagamentos() {
    setLoadingPag(true);
    const { data, error } = await supabase
      .from("pagamentos")
      .select("id, venda_id, valor, status, checkout_url, created_at, vendas(numero_venda, destino)")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar pagamentos");
    setPagamentos((data ?? []) as unknown as Pagamento[]);
    setLoadingPag(false);
  }

  async function loadVendas() {
    const { data } = await supabase
      .from("vendas")
      .select("id, numero_venda, destino, valor_total")
      .in("status", ["pendente", "confirmada", "concluida"])
      .order("numero_venda", { ascending: false });
    setVendas((data ?? []) as Venda[]);
  }

  useEffect(() => { loadPagamentos(); loadVendas(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && !selectedVenda) setSelectedVenda(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function criarCheckout() {
    if (!selectedVenda) { toast.error("Selecione uma venda."); return; }
    setCriando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getSupabasePublicUrl()}/functions/v1/criar-checkout-abacatepay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ venda_id: selectedVenda }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao criar checkout");
      toast.success("Checkout criado!", { description: "Link de pagamento gerado." });
      if (json.url) window.open(json.url, "_blank");
      await loadPagamentos();
    } catch (err) {
      toast.error("Erro ao gerar checkout", { description: formatSupabaseError(err) });
    } finally {
      setCriando(false);
    }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, "success" | "warning" | "destructive" | "default"> = {
      pago: "success",
      pendente: "warning",
      expirado: "destructive",
      cancelado: "destructive",
    };
    return <Badge variant={map[s] ?? "default"}>{s}</Badge>;
  };

  return (
    <>
      <Topbar title="Checkout / Pagamentos" subtitle="Gerencie links de pagamento AbacatePay" />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader><CardTitle>Gerar novo link de pagamento</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <label className="text-sm font-medium text-foreground">Venda</label>
                <Select value={selectedVenda} onChange={(e) => setSelectedVenda(e.target.value)}>
                  <option value="">Selecione uma venda...</option>
                  {vendas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.numero_venda} — {v.destino ?? "sem destino"} — {formatCurrency(Number(v.valor_total))}
                    </option>
                  ))}
                </Select>
              </div>
              <Button onClick={criarCheckout} disabled={criando || !selectedVenda}>
                {criando ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</> : "Gerar Link"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Histórico de pagamentos</CardTitle>
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 self-end sm:self-auto" onClick={loadPagamentos} aria-label="Atualizar lista"><RefreshCcw className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            {loadingPag ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : pagamentos.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="Nenhum pagamento registrado"
                description="Gere um link de pagamento para começar."
              />
            ) : (
              <>
                <MobileCardList
                  rows={pagamentos.map((p) => {
                    const v = Array.isArray(p.vendas) ? p.vendas[0] : p.vendas;
                    return {
                      key: p.id,
                      title: v?.numero_venda ?? "—",
                      subtitle: formatDateTime(p.created_at),
                      value: formatCurrency(Number(p.valor)),
                      badge: statusBadge(p.status),
                      actions: p.checkout_url ? (
                        <a
                          href={p.checkout_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border-subtle)] text-sm font-medium text-[var(--accent-600)] hover:bg-[var(--bg-hover)]"
                        >
                          Abrir link <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : undefined,
                    };
                  })}
                />
                <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Venda</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.map((p) => {
                    const v = Array.isArray(p.vendas) ? p.vendas[0] : p.vendas;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{formatDateTime(p.created_at)}</TableCell>
                        <TableCell>{v?.numero_venda ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(Number(p.valor))}</TableCell>
                        <TableCell>{statusBadge(p.status)}</TableCell>
                        <TableCell>
                          {p.checkout_url ? (
                            <a href={p.checkout_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent-600)] hover:underline">
                              Abrir <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : "—"}
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
    </>
  );
}
