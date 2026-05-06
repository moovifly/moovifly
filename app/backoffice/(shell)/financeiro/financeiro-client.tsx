"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";

import { Topbar } from "@/components/backoffice/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { formatCurrency, formatDate } from "@/lib/format";

type ContaReceber = { id: string; descricao: string | null; valor: number | string; data_vencimento: string | null; status: string };
type ContaPagar = { id: string; fornecedor: string | null; descricao: string | null; valor: number | string; data_vencimento: string | null; status: string };
type Comissao = {
  id: string;
  venda_id: string | null;
  valor: number | string;
  percentual: number | string | null;
  status: string;
  data_pagamento: string | null;
  usuarios?: { nome: string } | { nome: string }[] | null;
};

function vendorName(c: Comissao): string {
  const usr = Array.isArray(c.usuarios) ? c.usuarios[0] : c.usuarios;
  return usr?.nome ?? "—";
}

export function FinanceiroClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [tab, setTab] = useState("receber");
  const [receber, setReceber] = useState<ContaReceber[]>([]);
  const [pagar, setPagar] = useState<ContaPagar[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de pagamento de comissão
  const [payModal, setPayModal] = useState<{ id: string; nome: string; valor: number } | null>(null);
  const [payDate, setPayDate] = useState("");
  const [paying, setPaying] = useState(false);

  const isManager = profile && ["administrador", "gerente"].includes(profile.tipo);

  async function load() {
    setLoading(true);
    try {
      const [{ data: rec }, { data: com }] = await Promise.all([
        supabase.from("contas_receber").select("*").order("data_vencimento"),
        supabase.from("comissoes").select("*, usuarios(nome)").order("created_at", { ascending: false }),
      ]);
      setReceber((rec ?? []) as ContaReceber[]);
      setComissoes((com ?? []) as unknown as Comissao[]);

      if (isManager) {
        const { data: pag } = await supabase.from("contas_pagar").select("*").order("data_vencimento");
        setPagar((pag ?? []) as ContaPagar[]);
      }
    } catch (err) {
      toast.error("Erro ao carregar financeiro", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function marcarRecebido(id: string) {
    await supabase.from("contas_receber").update({ status: "recebido", data_recebimento: new Date().toISOString().slice(0, 10) }).eq("id", id);
    toast.success("Marcado como recebido!");
    load();
  }

  async function marcarPago(id: string) {
    await supabase.from("contas_pagar").update({ status: "pago", data_pagamento: new Date().toISOString().slice(0, 10) }).eq("id", id);
    toast.success("Marcado como pago!");
    load();
  }

  function abrirModalPagamentoComissao(c: Comissao) {
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayModal({ id: c.id, nome: vendorName(c), valor: Number(c.valor) });
  }

  async function confirmarPagamentoComissao() {
    if (!payModal || !payDate) return;
    setPaying(true);
    try {
      const { error } = await supabase
        .from("comissoes")
        .update({ status: "pago", data_pagamento: payDate })
        .eq("id", payModal.id);
      if (error) throw error;
      toast.success("Comissão marcada como paga!");
      setPayModal(null);
      load();
    } catch (err) {
      toast.error("Erro ao registrar pagamento", { description: formatSupabaseError(err) });
    } finally {
      setPaying(false);
    }
  }

  const comissoesPendentes = useMemo(() => comissoes.filter((c) => c.status === "pendente"), [comissoes]);
  const comissoesPagas = useMemo(() => comissoes.filter((c) => c.status === "pago"), [comissoes]);

  function statusBadge(status: string, map: Record<string, string>) {
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] ?? "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>{status}</span>;
  }

  const receberBadge = { recebido: "bg-[var(--success-bg)] text-[var(--success-text)]", cancelado: "bg-[var(--danger-bg)] text-[var(--danger-text)]" };
  const pagarBadge = { pago: "bg-[var(--success-bg)] text-[var(--success-text)]", cancelado: "bg-[var(--danger-bg)] text-[var(--danger-text)]" };
  const comissaoBadge = { pago: "bg-[var(--success-bg)] text-[var(--success-text)]", cancelado: "bg-[var(--danger-bg)] text-[var(--danger-text)]" };

  return (
    <>
      <Topbar title="Financeiro" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="receber">A Receber</TabsTrigger>
            {isManager && <TabsTrigger value="pagar">A Pagar</TabsTrigger>}
            {isManager && <TabsTrigger value="pagas">Contas Pagas</TabsTrigger>}
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          </TabsList>

          {/* A RECEBER */}
          <TabsContent value="receber">
            <Card>
              <CardHeader><CardTitle>Contas a Receber</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : receber.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nenhuma conta a receber.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receber.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.descricao ?? "—"}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                          <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                          <TableCell>{statusBadge(c.status, receberBadge)}</TableCell>
                          <TableCell className="text-right">
                            {c.status === "pendente" && (
                              <Button size="sm" variant="outline" onClick={() => marcarRecebido(c.id)}>
                                <CheckCircle className="h-4 w-4" /> Recebido
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* A PAGAR — contas_pagar + comissões pendentes */}
          {isManager && (
            <TabsContent value="pagar">
              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Contas a Pagar</CardTitle></CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : pagar.filter((c) => c.status === "pendente").length === 0 ? (
                      <p className="py-4 text-center text-sm text-[var(--text-secondary)]">Nenhuma conta a pagar.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagar.filter((c) => c.status === "pendente").map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>{c.fornecedor ?? "—"}</TableCell>
                              <TableCell>{c.descricao ?? "—"}</TableCell>
                              <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                              <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                              <TableCell>{statusBadge(c.status, pagarBadge)}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => marcarPago(c.id)}>
                                  <CheckCircle className="h-4 w-4" /> Pago
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Comissões Pendentes</CardTitle></CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : comissoesPendentes.length === 0 ? (
                      <p className="py-4 text-center text-sm text-[var(--text-secondary)]">Nenhuma comissão pendente.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendedor</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>%</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {comissoesPendentes.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>{vendorName(c)}</TableCell>
                              <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                              <TableCell>{c.percentual ? `${c.percentual}%` : "—"}</TableCell>
                              <TableCell>{statusBadge(c.status, comissaoBadge)}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="outline" onClick={() => abrirModalPagamentoComissao(c)}>
                                  <CheckCircle className="h-4 w-4" /> Pagar
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* CONTAS PAGAS — comissões pagas */}
          {isManager && (
            <TabsContent value="pagas">
              <Card>
                <CardHeader><CardTitle>Contas Pagas</CardTitle></CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : comissoesPagas.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nenhuma comissão paga ainda.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>%</TableHead>
                          <TableHead>Data de Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comissoesPagas.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{vendorName(c)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                            <TableCell>{c.percentual ? `${c.percentual}%` : "—"}</TableCell>
                            <TableCell>{formatDate(c.data_pagamento)}</TableCell>
                            <TableCell>{statusBadge(c.status, comissaoBadge)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* COMISSÕES — histórico completo */}
          <TabsContent value="comissoes">
            <Card>
              <CardHeader><CardTitle>Comissões</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : comissoes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nenhuma comissão registrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>%</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pago em</TableHead>
                        {isManager && <TableHead className="text-right">Ação</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comissoes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{vendorName(c)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                          <TableCell>{c.percentual ? `${c.percentual}%` : "—"}</TableCell>
                          <TableCell>{statusBadge(c.status, comissaoBadge)}</TableCell>
                          <TableCell>{c.data_pagamento ? formatDate(c.data_pagamento) : "—"}</TableCell>
                          {isManager && (
                            <TableCell className="text-right">
                              {c.status === "pendente" && (
                                <Button size="sm" variant="outline" onClick={() => abrirModalPagamentoComissao(c)}>
                                  <CheckCircle className="h-4 w-4" /> Pagar
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de pagamento de comissão */}
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
    </>
  );
}
