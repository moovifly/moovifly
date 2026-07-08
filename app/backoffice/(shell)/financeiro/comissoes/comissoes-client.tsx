"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Plus, Trash2 } from "lucide-react";

import { Topbar } from "@/components/backoffice/topbar";
import { MobileCardList } from "@/components/backoffice/mobile-card-list";
import { FinancePeriodFilter } from "@/components/financeiro/finance-period-filter";
import { FinanceiroNav } from "@/components/financeiro/financeiro-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showConfirm } from "@/components/confirm-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { formatCurrency, formatDate } from "@/lib/format";
import { defaultFinancePeriod } from "@/lib/financial/period";
import {
  COMISSAO_BADGE,
  type Comissao,
  saleDate,
  saleLabel,
  vendorName,
} from "@/lib/financial/comissoes";

type Usuario = { id: string; nome: string; tipo: string };

export function ComissoesClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();

  const [subComissoes, setSubComissoes] = useState("pendentes");
  const [comissaoVendedorFilter, setComissaoVendedorFilter] = useState("");
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const [payModal, setPayModal] = useState<{ id: string; nome: string; valor: number } | null>(null);
  const [payDate, setPayDate] = useState("");
  const [paying, setPaying] = useState(false);

  const [addComissaoOpen, setAddComissaoOpen] = useState(false);
  const [comForm, setComForm] = useState({
    vendedor_id: "",
    valor_venda: 0,
    base_calculo: null as number | null,
    percentual_comissao: "",
    status: "pendente",
    data_pagamento: "",
  });
  const [saving, setSaving] = useState(false);

  const isManager = profile && ["administrador", "gerente"].includes(profile.tipo);

  const MAX_DAYS = 90;
  const [period, setPeriod] = useState(defaultFinancePeriod);
  const dateFrom = period.start;
  const dateTo = period.end;

  async function load() {
    setLoading(true);
    try {
      const toTs = dateTo + "T23:59:59";
      const comissaoSelect = "*, usuarios(nome), vendas(numero_venda, descricao, data_venda)";
      const [{ data: comPendVenda }, { data: comPendManual }, { data: comPagas }, { data: usr }] = await Promise.all([
        supabase
          .from("comissoes")
          .select("*, usuarios(nome), vendas!inner(numero_venda, descricao, data_venda)")
          .eq("status", "pendente")
          .gte("vendas.data_venda", dateFrom)
          .lte("vendas.data_venda", dateTo)
          .order("created_at", { ascending: false }),
        supabase
          .from("comissoes")
          .select(comissaoSelect)
          .eq("status", "pendente")
          .is("venda_id", null)
          .gte("created_at", dateFrom)
          .lte("created_at", toTs)
          .order("created_at", { ascending: false }),
        supabase
          .from("comissoes")
          .select(comissaoSelect)
          .eq("status", "paga")
          .gte("data_pagamento", dateFrom)
          .lte("data_pagamento", dateTo)
          .order("data_pagamento", { ascending: false }),
        isManager ? supabase.from("usuarios").select("id, nome, tipo").order("nome") : Promise.resolve({ data: [] }),
      ]);

      const comMap = new Map<string, Comissao>();
      for (const row of [...(comPendVenda ?? []), ...(comPendManual ?? []), ...(comPagas ?? [])]) {
        comMap.set(row.id, row as unknown as Comissao);
      }
      setComissoes([...comMap.values()]);
      setUsuarios((usr ?? []) as Usuario[]);
    } catch (err) {
      toast.error("Erro ao carregar comissões", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, dateFrom, dateTo]);

  function abrirModalPagamentoComissao(c: Comissao) {
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayModal({ id: c.id, nome: vendorName(c), valor: Number(c.valor_comissao) });
  }

  async function confirmarPagamentoComissao() {
    if (!payModal || !payDate) return;
    setPaying(true);
    try {
      const { error } = await supabase
        .from("comissoes")
        .update({ status: "paga", data_pagamento: payDate })
        .eq("id", payModal.id)
        .select("id");
      if (error) throw error;
      toast.success("Comissão marcada como paga! Conta a pagar vinculada atualizada automaticamente.");
      setPayModal(null);
      load();
    } catch (err) {
      toast.error("Erro ao registrar pagamento", { description: formatSupabaseError(err) });
    } finally {
      setPaying(false);
    }
  }

  async function criarComissaoManual() {
    setSaving(true);
    try {
      const valor_venda = comForm.valor_venda;
      const base_calculo = comForm.base_calculo ?? valor_venda;
      const percentual = Number(comForm.percentual_comissao);
      const valor_comissao = Math.round(((base_calculo * percentual) / 100) * 100) / 100;

      if (!comForm.vendedor_id) { toast.error("Selecione um vendedor."); return; }
      if (!Number.isFinite(valor_venda) || valor_venda < 0) { toast.error("Informe o valor da venda."); return; }
      if (!Number.isFinite(base_calculo) || base_calculo < 0) { toast.error("Informe a base de cálculo."); return; }
      if (!Number.isFinite(percentual) || percentual < 0) { toast.error("Informe o percentual de comissão."); return; }

      const payload: Record<string, unknown> = {
        vendedor_id: comForm.vendedor_id,
        valor_venda,
        base_calculo,
        percentual_comissao: percentual,
        valor_comissao,
        status: comForm.status,
        data_pagamento: comForm.status === "paga" ? (comForm.data_pagamento || new Date().toISOString().slice(0, 10)) : null,
      };

      const { error } = await supabase.from("comissoes").insert(payload);
      if (error) throw error;
      toast.success("Comissão adicionada!");
      setAddComissaoOpen(false);
      setComForm({ vendedor_id: "", valor_venda: 0, base_calculo: null, percentual_comissao: "", status: "pendente", data_pagamento: "" });
      load();
    } catch (err) {
      toast.error("Erro ao adicionar comissão", { description: formatSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  }

  async function excluirComissao(id: string) {
    const ok = await showConfirm({
      title: "Excluir comissão",
      message: "Tem certeza que deseja excluir esta comissão?",
      destructive: true,
      confirmText: "Excluir",
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from("comissoes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Comissão excluída.");
      load();
    } catch (err) {
      toast.error("Erro ao excluir", { description: formatSupabaseError(err) });
    }
  }

  const comissoesFiltradas = useMemo(() => {
    if (!comissaoVendedorFilter) return comissoes;
    return comissoes.filter((c) => c.vendedor_id === comissaoVendedorFilter);
  }, [comissoes, comissaoVendedorFilter]);

  const comissoesPendentes = useMemo(
    () => comissoesFiltradas.filter((c) => c.status === "pendente"),
    [comissoesFiltradas],
  );
  const comissoesPagas = useMemo(
    () => comissoesFiltradas.filter((c) => c.status === "paga"),
    [comissoesFiltradas],
  );

  function statusBadge(status: string) {
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COMISSAO_BADGE[status as keyof typeof COMISSAO_BADGE] ?? "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
        {status}
      </span>
    );
  }

  const skeletons = (n = 4) => (
    <div className="space-y-2">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
  );

  return (
    <>
      <Topbar title="Comissões" subtitle="Detalhamento por venda" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <FinanceiroNav />
        <FinancePeriodFilter period={period} onChange={setPeriod} maxCustomDays={MAX_DAYS} />

        <Tabs value={subComissoes} onValueChange={setSubComissoes}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <TabsList>
                <TabsTrigger value="pendentes">
                  A Pagar
                  {comissoesPendentes.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning-text)]">
                      {comissoesPendentes.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="pagas">Pagas</TabsTrigger>
              </TabsList>
              {isManager && (
                <div className="space-y-1">
                  <Label className="sr-only">Vendedor</Label>
                  <Select
                    value={comissaoVendedorFilter}
                    onChange={(e) => setComissaoVendedorFilter(e.target.value)}
                    className="w-52"
                  >
                    <option value="">Todos os vendedores</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            {isManager && (
              <Button size="sm" onClick={() => setAddComissaoOpen(true)}>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            )}
          </div>

          <TabsContent value="pendentes">
            <Card>
              <CardHeader><CardTitle>Comissões a Pagar</CardTitle></CardHeader>
              <CardContent>
                {loading ? skeletons(3) : comissoesPendentes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nenhuma comissão pendente.</p>
                ) : (
                  <>
                    <MobileCardList
                      rows={comissoesPendentes.map((c) => ({
                        key: c.id,
                        title: vendorName(c),
                        subtitle: saleLabel(c),
                        value: formatCurrency(Number(c.valor_comissao)),
                        details: [
                          { label: "Data da venda", value: saleDate(c) },
                          { label: "%", value: c.percentual_comissao ? `${c.percentual_comissao}%` : "—" },
                        ],
                        badge: statusBadge(c.status),
                        actions: isManager ? (
                          <>
                            <Button variant="outline" className="h-11 flex-1" onClick={() => abrirModalPagamentoComissao(c)}>
                              <CheckCircle className="h-4 w-4" /> Pagar
                            </Button>
                            <Button size="icon" variant="ghost" className="h-11 w-11 text-[var(--danger-text)] hover:bg-[var(--danger-bg)]" onClick={() => excluirComissao(c.id)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : undefined,
                      }))}
                    />
                    <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Venda</TableHead>
                        <TableHead>Data da venda</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>%</TableHead>
                        <TableHead>Status</TableHead>
                        {isManager && <TableHead className="text-right">Ação</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comissoesPendentes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{vendorName(c)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{saleLabel(c)}</TableCell>
                          <TableCell>{saleDate(c)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(Number(c.valor_comissao))}</TableCell>
                          <TableCell>{c.percentual_comissao ? `${c.percentual_comissao}%` : "—"}</TableCell>
                          <TableCell>{statusBadge(c.status)}</TableCell>
                          {isManager && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => abrirModalPagamentoComissao(c)}>
                                  <CheckCircle className="h-4 w-4" /> Pagar
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => excluirComissao(c.id)} title="Excluir" className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagas">
            <Card>
              <CardHeader><CardTitle>Comissões Pagas</CardTitle></CardHeader>
              <CardContent>
                {loading ? skeletons() : comissoesPagas.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nenhuma comissão paga no período.</p>
                ) : (
                  <>
                    <MobileCardList
                      rows={comissoesPagas.map((c) => ({
                        key: c.id,
                        title: vendorName(c),
                        subtitle: saleLabel(c),
                        value: formatCurrency(Number(c.valor_comissao)),
                        details: [
                          { label: "Data da venda", value: saleDate(c) },
                          { label: "Pago em", value: formatDate(c.data_pagamento) },
                          { label: "%", value: c.percentual_comissao ? `${c.percentual_comissao}%` : "—" },
                        ],
                        badge: statusBadge(c.status),
                        actions: isManager ? (
                          <Button size="icon" variant="ghost" className="h-11 w-11 text-[var(--danger-text)] hover:bg-[var(--danger-bg)]" onClick={() => excluirComissao(c.id)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : undefined,
                      }))}
                    />
                    <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Venda</TableHead>
                        <TableHead>Data da venda</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>%</TableHead>
                        <TableHead>Pago em</TableHead>
                        <TableHead>Status</TableHead>
                        {isManager && <TableHead className="text-right">Ação</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comissoesPagas.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{vendorName(c)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{saleLabel(c)}</TableCell>
                          <TableCell>{saleDate(c)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(Number(c.valor_comissao))}</TableCell>
                          <TableCell>{c.percentual_comissao ? `${c.percentual_comissao}%` : "—"}</TableCell>
                          <TableCell>{formatDate(c.data_pagamento)}</TableCell>
                          <TableCell>{statusBadge(c.status)}</TableCell>
                          {isManager && (
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" onClick={() => excluirComissao(c.id)} title="Excluir" className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!payModal} onOpenChange={(open) => { if (!open) setPayModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento de Comissão</DialogTitle>
          </DialogHeader>
          {payModal && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-[var(--text-secondary)]">
                Vendedor: <span className="font-medium text-foreground">{payModal.nome}</span>
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Valor: <span className="font-semibold text-foreground">{formatCurrency(payModal.valor)}</span>
              </p>
              <div className="space-y-1.5">
                <Label>Data de pagamento</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayModal(null)} disabled={paying}>Cancelar</Button>
            <Button onClick={confirmarPagamentoComissao} disabled={paying || !payDate}>
              {paying ? "Salvando..." : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addComissaoOpen} onOpenChange={setAddComissaoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar comissão</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vendedor</Label>
              <Select value={comForm.vendedor_id} onChange={(e) => setComForm((p) => ({ ...p, vendedor_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {usuarios
                  .filter((u) => u.tipo === "vendedor")
                  .map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor da venda</Label>
              <CurrencyInput value={comForm.valor_venda} onValueChange={(v) => setComForm((p) => ({ ...p, valor_venda: v ?? 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Base de cálculo</Label>
              <CurrencyInput
                allowEmpty
                value={comForm.base_calculo}
                onValueChange={(v) => setComForm((p) => ({ ...p, base_calculo: v }))}
                placeholder="Se vazio, usa o valor da venda"
              />
            </div>
            <div className="space-y-1.5">
              <Label>% Comissão</Label>
              <Input inputMode="decimal" value={comForm.percentual_comissao} onChange={(e) => setComForm((p) => ({ ...p, percentual_comissao: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={comForm.status} onChange={(e) => setComForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="pendente">Pendente</option>
                <option value="paga">Paga</option>
                <option value="cancelada">Cancelada</option>
              </Select>
            </div>
            {comForm.status === "paga" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Data de pagamento</Label>
                <Input type="date" value={comForm.data_pagamento} onChange={(e) => setComForm((p) => ({ ...p, data_pagamento: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddComissaoOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={criarComissaoManual} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
