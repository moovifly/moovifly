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
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";

type ContaReceber = { id: string; descricao: string | null; valor: number | string; data_vencimento: string | null; status: string };
type ContaPagar = { id: string; fornecedor: string | null; descricao: string | null; valor: number | string; data_vencimento: string | null; status: string };
type Comissao = { id: string; venda_id: string | null; valor: number | string; percentual: number | string | null; status: string; usuarios?: { nome: string } | { nome: string }[] | null };

export function FinanceiroClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [tab, setTab] = useState("receber");
  const [receber, setReceber] = useState<ContaReceber[]>([]);
  const [pagar, setPagar] = useState<ContaPagar[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [loading, setLoading] = useState(true);

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
      toast.error("Erro ao carregar financeiro", { description: String(err) });
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

  async function marcarComissaoPaga(id: string) {
    await supabase.from("comissoes").update({ status: "pago", data_pagamento: new Date().toISOString().slice(0, 10) }).eq("id", id);
    toast.success("Comissão marcada como paga!");
    load();
  }

  return (
    <>
      <Topbar title="Financeiro" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="receber">A Receber</TabsTrigger>
            {isManager && <TabsTrigger value="pagar">A Pagar</TabsTrigger>}
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          </TabsList>

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
                          <TableCell>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "recebido" ? "bg-[var(--success-bg)] text-[var(--success-text)]" : c.status === "cancelado" ? "bg-[var(--danger-bg)] text-[var(--danger-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
                              {c.status}
                            </span>
                          </TableCell>
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

          {isManager && (
            <TabsContent value="pagar">
              <Card>
                <CardHeader><CardTitle>Contas a Pagar</CardTitle></CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : pagar.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nenhuma conta a pagar.</p>
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
                        {pagar.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.fornecedor ?? "—"}</TableCell>
                            <TableCell>{c.descricao ?? "—"}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                            <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                            <TableCell>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "pago" ? "bg-[var(--success-bg)] text-[var(--success-text)]" : c.status === "cancelado" ? "bg-[var(--danger-bg)] text-[var(--danger-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
                                {c.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {c.status === "pendente" && (
                                <Button size="sm" variant="outline" onClick={() => marcarPago(c.id)}>
                                  <CheckCircle className="h-4 w-4" /> Pago
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
          )}

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
                        {isManager && <TableHead className="text-right">Ação</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comissoes.map((c) => {
                        const usr = Array.isArray(c.usuarios) ? c.usuarios[0] : c.usuarios;
                        return (
                          <TableRow key={c.id}>
                            <TableCell>{usr?.nome ?? "—"}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                            <TableCell>{c.percentual ? `${c.percentual}%` : "—"}</TableCell>
                            <TableCell>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "pago" ? "bg-[var(--success-bg)] text-[var(--success-text)]" : c.status === "cancelado" ? "bg-[var(--danger-bg)] text-[var(--danger-text)]" : "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>
                                {c.status}
                              </span>
                            </TableCell>
                            {isManager && (
                              <TableCell className="text-right">
                                {c.status === "pendente" && (
                                  <Button size="sm" variant="outline" onClick={() => marcarComissaoPaga(c.id)}>
                                    <CheckCircle className="h-4 w-4" /> Pagar
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
