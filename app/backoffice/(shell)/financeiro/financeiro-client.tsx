"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Pencil, Plus, Trash2 } from "lucide-react";

import { Topbar } from "@/components/backoffice/topbar";
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

type ContaReceber = {
  id: string;
  descricao: string | null;
  valor: number | string;
  data_vencimento: string | null;
  data_recebimento?: string | null;
  conta_bancaria_id?: string | null;
  status: string;
};
type ContaPagar = {
  id: string;
  fornecedor: string | null;
  descricao: string | null;
  valor: number | string;
  data_vencimento: string | null;
  data_pagamento?: string | null;
  status: string;
};
type Comissao = {
  id: string;
  venda_id: string | null;
  vendedor_id?: string | null;
  valor_venda: number | string;
  base_calculo: number | string | null;
  percentual_comissao: number | string;
  valor_comissao: number | string;
  status: string;
  data_pagamento: string | null;
  usuarios?: { nome: string } | { nome: string }[] | null;
  vendas?: { numero_venda: string | null; descricao: string | null; data_venda: string | null } | null;
};

type Usuario = { id: string; nome: string; tipo: string };
type ContaBancaria = { id: string; nome: string; banco: string | null; principal: boolean };

function vendorName(c: Comissao): string {
  const usr = Array.isArray(c.usuarios) ? c.usuarios[0] : c.usuarios;
  return usr?.nome ?? "—";
}

function saleLabel(c: Comissao): string {
  const v = c.vendas;
  if (!v) return "—";
  const parts = [v.numero_venda ? `#${v.numero_venda}` : null, v.descricao].filter(Boolean);
  return parts.join(" · ") || "—";
}

function saleDate(c: Comissao): string {
  const data = c.vendas?.data_venda;
  return data ? formatDate(data) : "—";
}

export function FinanceiroClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [section, setSection] = useState("receber");
  const [subReceber, setSubReceber] = useState("pendentes");
  const [subPagar, setSubPagar] = useState("pendentes");
  const [subComissoes, setSubComissoes] = useState("pendentes");
  const [comissaoVendedorFilter, setComissaoVendedorFilter] = useState("");

  const [receber, setReceber] = useState<ContaReceber[]>([]);
  const [pagar, setPagar] = useState<ContaPagar[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de pagamento de comissão
  const [payModal, setPayModal] = useState<{ id: string; nome: string; valor: number } | null>(null);
  const [payDate, setPayDate] = useState("");
  const [paying, setPaying] = useState(false);

  // Modal de pagamento de conta a pagar
  const [pagarModal, setPagarModal] = useState<{
    id: string;
    fornecedor: string;
    descricao: string;
    valorOriginal: number;
  } | null>(null);
  const [pagarModalValor, setPagarModalValor] = useState(0);
  const [pagarModalData, setPagarModalData] = useState("");
  const [pagandoConta, setPagandoConta] = useState(false);

  // Modal de recebimento de conta a receber
  const [receberModal, setReceberModal] = useState<{
    id: string;
    descricao: string;
    valorOriginal: number;
  } | null>(null);
  const [receberModalValor, setReceberModalValor] = useState(0);
  const [receberModalData, setReceberModalData] = useState("");
  const [receberModalContaId, setReceberModalContaId] = useState("");
  const [recebendoConta, setRecebendoConta] = useState(false);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);

  // Modal de edição de conta a receber
  const [editReceberOpen, setEditReceberOpen] = useState(false);
  const [editRecForm, setEditRecForm] = useState({
    id: "",
    descricao: "",
    valor: 0,
    data_vencimento: "",
    status: "pendente" as "pendente" | "recebida",
    data_recebimento: "",
    conta_bancaria_id: "",
  });
  const [editandoReceber, setEditandoReceber] = useState(false);

  // Modais de criação manual
  const [addReceberOpen, setAddReceberOpen] = useState(false);
  const [addPagarOpen, setAddPagarOpen] = useState(false);
  const [addPagasOpen, setAddPagasOpen] = useState(false);
  const [addComissaoOpen, setAddComissaoOpen] = useState(false);

  const [recForm, setRecForm] = useState({ descricao: "", valor: 0, data_vencimento: "" });
  const [pagForm, setPagForm] = useState({ fornecedor: "", descricao: "", valor: 0, data_vencimento: "" });
  const [pagaForm, setPagaForm] = useState({ fornecedor: "", descricao: "", valor: 0, data_pagamento: "" });
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
      const [{ data: recPendentes }, { data: recRecebidas }, { data: comPendVenda }, { data: comPendManual }, { data: comPagas }, { data: usr }] = await Promise.all([
        supabase.from("contas_receber").select("*").eq("status", "pendente").gte("data_vencimento", dateFrom).lte("data_vencimento", dateTo).order("data_vencimento"),
        supabase.from("contas_receber").select("*").neq("status", "pendente").gte("data_recebimento", dateFrom).lte("data_recebimento", dateTo).order("data_recebimento"),
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
      setReceber([...(recPendentes ?? []), ...(recRecebidas ?? [])] as ContaReceber[]);
      const comMap = new Map<string, Comissao>();
      for (const row of [...(comPendVenda ?? []), ...(comPendManual ?? []), ...(comPagas ?? [])]) {
        comMap.set(row.id, row as unknown as Comissao);
      }
      setComissoes([...comMap.values()]);
      setUsuarios((usr ?? []) as Usuario[]);

      if (isManager) {
        const [{ data: pagPendentes }, { data: pagPagas }, { data: bancos }] = await Promise.all([
          supabase.from("contas_pagar").select("*").eq("status", "pendente").order("data_vencimento"),
          supabase.from("contas_pagar").select("*").neq("status", "pendente").gte("data_pagamento", dateFrom).lte("data_pagamento", dateTo).order("data_pagamento"),
          supabase.from("contas_bancarias").select("id, nome, banco, principal").eq("ativa", true).order("nome"),
        ]);
        setPagar([...(pagPendentes ?? []), ...(pagPagas ?? [])] as ContaPagar[]);
        setContasBancarias((bancos ?? []) as ContaBancaria[]);
      } else {
        setPagar([]);
        setContasBancarias([]);
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
  }, [profile?.id, dateFrom, dateTo]);

  function defaultContaBancariaId(contas: ContaBancaria[]): string {
    return contas.find((c) => c.principal)?.id ?? contas[0]?.id ?? "";
  }

  function abrirModalRecebimento(c: ContaReceber) {
    const valor = Number(c.valor);
    setReceberModal({
      id: c.id,
      descricao: c.descricao ?? "—",
      valorOriginal: valor,
    });
    setReceberModalValor(valor);
    setReceberModalData(new Date().toISOString().slice(0, 10));
    setReceberModalContaId(defaultContaBancariaId(contasBancarias));
  }

  async function confirmarRecebimento() {
    if (!receberModal || !receberModalData) return;
    if (!Number.isFinite(receberModalValor) || receberModalValor <= 0) {
      toast.error("Informe um valor recebido válido.");
      return;
    }
    if (contasBancarias.length > 0 && !receberModalContaId) {
      toast.error("Selecione a conta bancária de recebimento.");
      return;
    }
    setRecebendoConta(true);
    try {
      const { error } = await supabase
        .from("contas_receber")
        .update({
          status: "recebida",
          valor: receberModalValor,
          data_recebimento: receberModalData,
          conta_bancaria_id: receberModalContaId || null,
        })
        .eq("id", receberModal.id)
        .select("id");
      if (error) throw error;
      toast.success("Marcado como recebido!");
      setReceberModal(null);
      load();
    } catch (err) {
      toast.error("Erro ao registrar recebimento", { description: formatSupabaseError(err) });
    } finally {
      setRecebendoConta(false);
    }
  }

  function abrirEditarReceber(c: ContaReceber) {
    const recebida = c.status === "recebida";
    setEditRecForm({
      id: c.id,
      descricao: c.descricao ?? "",
      valor: Number(c.valor),
      data_vencimento: c.data_vencimento ?? "",
      status: recebida ? "recebida" : "pendente",
      data_recebimento: c.data_recebimento ?? new Date().toISOString().slice(0, 10),
      conta_bancaria_id: c.conta_bancaria_id ?? defaultContaBancariaId(contasBancarias),
    });
    setEditReceberOpen(true);
  }

  async function salvarEditarReceber() {
    if (!editRecForm.id) return;
    if (!editRecForm.descricao.trim()) {
      toast.error("Informe a descrição.");
      return;
    }
    if (!editRecForm.data_vencimento) {
      toast.error("Informe o vencimento.");
      return;
    }
    if (!Number.isFinite(editRecForm.valor) || editRecForm.valor <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (editRecForm.status === "recebida") {
      if (!editRecForm.data_recebimento) {
        toast.error("Informe a data de recebimento.");
        return;
      }
      if (contasBancarias.length > 0 && !editRecForm.conta_bancaria_id) {
        toast.error("Selecione a conta bancária.");
        return;
      }
    }

    setEditandoReceber(true);
    try {
      const payload: Record<string, unknown> = {
        descricao: editRecForm.descricao.trim(),
        valor: editRecForm.valor,
        data_vencimento: editRecForm.data_vencimento,
        status: editRecForm.status,
      };
      if (editRecForm.status === "recebida") {
        payload.data_recebimento = editRecForm.data_recebimento;
        payload.conta_bancaria_id = editRecForm.conta_bancaria_id || null;
      } else {
        payload.data_recebimento = null;
        payload.conta_bancaria_id = null;
      }

      const { error } = await supabase.from("contas_receber").update(payload).eq("id", editRecForm.id);
      if (error) throw error;
      toast.success("Conta a receber atualizada!");
      setEditReceberOpen(false);
      load();
    } catch (err) {
      toast.error("Erro ao salvar", { description: formatSupabaseError(err) });
    } finally {
      setEditandoReceber(false);
    }
  }

  function abrirModalPagamentoContaPagar(c: ContaPagar) {
    const valor = Number(c.valor);
    setPagarModal({
      id: c.id,
      fornecedor: c.fornecedor ?? "—",
      descricao: c.descricao ?? "—",
      valorOriginal: valor,
    });
    setPagarModalValor(valor);
    setPagarModalData(new Date().toISOString().slice(0, 10));
  }

  async function confirmarPagamentoContaPagar() {
    if (!pagarModal || !pagarModalData) return;
    if (!Number.isFinite(pagarModalValor) || pagarModalValor <= 0) {
      toast.error("Informe um valor pago válido.");
      return;
    }
    setPagandoConta(true);
    try {
      const { error } = await supabase
        .from("contas_pagar")
        .update({
          status: "paga",
          valor: pagarModalValor,
          data_pagamento: pagarModalData,
        })
        .eq("id", pagarModal.id)
        .select("id");
      if (error) throw error;
      toast.success("Marcado como pago!");
      setPagarModal(null);
      load();
    } catch (err) {
      toast.error("Erro ao marcar como pago", { description: formatSupabaseError(err) });
    } finally {
      setPagandoConta(false);
    }
  }

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

  async function criarContaReceber() {
    setSaving(true);
    try {
      const payload = {
        descricao: recForm.descricao.trim(),
        valor: recForm.valor,
        data_vencimento: recForm.data_vencimento,
        status: "pendente",
      };
      if (!payload.descricao || !payload.data_vencimento || !Number.isFinite(payload.valor)) {
        toast.error("Preencha descrição, valor e vencimento.");
        return;
      }
      const { error } = await supabase.from("contas_receber").insert(payload);
      if (error) throw error;
      toast.success("Conta a receber adicionada!");
      setAddReceberOpen(false);
      setRecForm({ descricao: "", valor: 0, data_vencimento: "" });
      load();
    } catch (err) {
      toast.error("Erro ao adicionar", { description: formatSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  }

  async function criarContaPagar(status: "pendente" | "paga") {
    setSaving(true);
    try {
      const base = status === "paga" ? pagaForm : pagForm;
      const payload: Record<string, unknown> = {
        fornecedor: (base.fornecedor ?? "").trim(),
        descricao: (base.descricao ?? "").trim(),
        valor: base.valor,
        status,
      };
      if (!payload.fornecedor || !payload.descricao || !Number.isFinite(payload.valor)) {
        toast.error("Preencha fornecedor, descrição e valor.");
        return;
      }
      if (status === "pendente") {
        payload.data_vencimento = (pagForm.data_vencimento ?? "").trim();
        if (!payload.data_vencimento) {
          toast.error("Informe o vencimento.");
          return;
        }
      } else {
        const dt = (pagaForm.data_pagamento ?? "").trim();
        payload.data_vencimento = dt || new Date().toISOString().slice(0, 10);
        payload.data_pagamento = dt || new Date().toISOString().slice(0, 10);
      }

      const { error } = await supabase.from("contas_pagar").insert(payload);
      if (error) throw error;
      toast.success(status === "paga" ? "Conta paga adicionada!" : "Conta a pagar adicionada!");
      if (status === "paga") {
        setAddPagasOpen(false);
        setPagaForm({ fornecedor: "", descricao: "", valor: 0, data_pagamento: "" });
      } else {
        setAddPagarOpen(false);
        setPagForm({ fornecedor: "", descricao: "", valor: 0, data_vencimento: "" });
      }
      load();
    } catch (err) {
      toast.error("Erro ao adicionar", { description: formatSupabaseError(err) });
    } finally {
      setSaving(false);
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

  async function excluirContaReceber(id: string) {
    const ok = await showConfirm({ title: "Excluir conta a receber", message: "Tem certeza que deseja excluir este lançamento?", destructive: true, confirmText: "Excluir" });
    if (!ok) return;
    try {
      const { error } = await supabase.from("contas_receber").delete().eq("id", id);
      if (error) throw error;
      toast.success("Conta excluída.");
      load();
    } catch (err) {
      toast.error("Erro ao excluir", { description: formatSupabaseError(err) });
    }
  }

  async function excluirContaPagar(id: string) {
    const ok = await showConfirm({ title: "Excluir conta", message: "Tem certeza que deseja excluir este lançamento?", destructive: true, confirmText: "Excluir" });
    if (!ok) return;
    try {
      const { error } = await supabase.from("contas_pagar").delete().eq("id", id);
      if (error) throw error;
      toast.success("Conta excluída.");
      load();
    } catch (err) {
      toast.error("Erro ao excluir", { description: formatSupabaseError(err) });
    }
  }

  async function excluirComissao(id: string) {
    const ok = await showConfirm({ title: "Excluir comissão", message: "Tem certeza que deseja excluir esta comissão?", destructive: true, confirmText: "Excluir" });
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

  const receberPendentes = useMemo(() => receber.filter((c) => c.status === "pendente"), [receber]);
  const recebidas = useMemo(() => receber.filter((c) => c.status !== "pendente"), [receber]);
  const contasPagarPendentes = useMemo(() => pagar.filter((c) => c.status === "pendente"), [pagar]);
  const contasPagarPagas = useMemo(() => pagar.filter((c) => c.status !== "pendente"), [pagar]);
  const comissoesFiltradas = useMemo(() => {
    if (!comissaoVendedorFilter) return comissoes;
    return comissoes.filter((c) => c.vendedor_id === comissaoVendedorFilter);
  }, [comissoes, comissaoVendedorFilter]);

  const comissoesPendentes = useMemo(() => comissoesFiltradas.filter((c) => c.status === "pendente"), [comissoesFiltradas]);
  const comissoesPagas = useMemo(() => comissoesFiltradas.filter((c) => c.status === "paga"), [comissoesFiltradas]);

  function statusBadge(status: string, map: Record<string, string>) {
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] ?? "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>{status}</span>;
  }

  const receberBadge = { recebida: "bg-[var(--success-bg)] text-[var(--success-text)]", cancelada: "bg-[var(--danger-bg)] text-[var(--danger-text)]" };
  const pagarBadge = { paga: "bg-[var(--success-bg)] text-[var(--success-text)]", cancelada: "bg-[var(--danger-bg)] text-[var(--danger-text)]" };
  const comissaoBadge = { paga: "bg-[var(--success-bg)] text-[var(--success-text)]", cancelada: "bg-[var(--danger-bg)] text-[var(--danger-text)]" };

  const skeletons = (n = 4) => (
    <div className="space-y-2">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
  );

  return (
    <>
      <Topbar title="Financeiro" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <FinanceiroNav />
        <FinancePeriodFilter period={period} onChange={setPeriod} maxCustomDays={MAX_DAYS} />

        {/* Navegação principal (submenus) */}
        <Tabs value={section} onValueChange={setSection}>
          <TabsList>
            <TabsTrigger value="receber">Contas A/R</TabsTrigger>
            {isManager && <TabsTrigger value="pagar">Contas A/P</TabsTrigger>}
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          </TabsList>

          {/* ── CONTAS A RECEBER E RECEBIDAS ── */}
          <TabsContent value="receber">
            <Tabs value={subReceber} onValueChange={setSubReceber}>
              <div className="mb-4 flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="pendentes">
                    A Receber
                    {receberPendentes.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning-text)]">
                        {receberPendentes.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="recebidas">Recebidas</TabsTrigger>
                </TabsList>
                {isManager && (
                  <Button size="sm" onClick={() => { setAddReceberOpen(true); setRecForm({ descricao: "", valor: 0, data_vencimento: new Date().toISOString().slice(0, 10) }); }}>
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                )}
              </div>

              <TabsContent value="pendentes">
                <Card>
                  <CardHeader><CardTitle>A Receber</CardTitle></CardHeader>
                  <CardContent>
                    {loading ? skeletons() : receberPendentes.length === 0 ? (
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
                          {receberPendentes.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>{c.descricao ?? "—"}</TableCell>
                              <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                              <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                              <TableCell>{statusBadge(c.status, receberBadge)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => abrirModalRecebimento(c)}>
                                    <CheckCircle className="h-4 w-4" /> Recebido
                                  </Button>
                                  {isManager && (
                                    <>
                                      <Button size="icon" variant="ghost" onClick={() => abrirEditarReceber(c)} title="Editar">
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" onClick={() => excluirContaReceber(c.id)} title="Excluir" className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="recebidas">
                <Card>
                  <CardHeader><CardTitle>Recebidas</CardTitle></CardHeader>
                  <CardContent>
                    {loading ? skeletons() : recebidas.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Nenhuma conta recebida no período.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Recebido em</TableHead>
                            <TableHead>Status</TableHead>
                            {isManager && <TableHead className="text-right">Ação</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recebidas.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>{c.descricao ?? "—"}</TableCell>
                              <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                              <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                              <TableCell>{formatDate(c.data_recebimento)}</TableCell>
                              <TableCell>{statusBadge(c.status, receberBadge)}</TableCell>
                              {isManager && (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button size="icon" variant="ghost" onClick={() => abrirEditarReceber(c)} title="Editar">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => excluirContaReceber(c.id)} title="Excluir" className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
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
          </TabsContent>

          {/* ── CONTAS A PAGAR E PAGAS ── */}
          {isManager && (
            <TabsContent value="pagar">
              <Tabs value={subPagar} onValueChange={setSubPagar}>
                <div className="mb-4 flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="pendentes">
                      A Pagar
                      {contasPagarPendentes.length > 0 && (
                        <span className="ml-1.5 rounded-full bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning-text)]">
                          {contasPagarPendentes.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="pagas">Pagas</TabsTrigger>
                  </TabsList>
                  {subPagar === "pendentes" ? (
                    <Button size="sm" onClick={() => { setAddPagarOpen(true); setPagForm({ fornecedor: "", descricao: "", valor: 0, data_vencimento: new Date().toISOString().slice(0, 10) }); }}>
                      <Plus className="h-4 w-4" /> Adicionar
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => { setAddPagasOpen(true); setPagaForm({ fornecedor: "", descricao: "", valor: 0, data_pagamento: new Date().toISOString().slice(0, 10) }); }}>
                      <Plus className="h-4 w-4" /> Adicionar
                    </Button>
                  )}
                </div>

                <TabsContent value="pendentes">
                  <Card>
                    <CardHeader><CardTitle>Contas a Pagar</CardTitle></CardHeader>
                    <CardContent>
                      {loading ? skeletons(3) : contasPagarPendentes.length === 0 ? (
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
                            {contasPagarPendentes.map((c) => (
                              <TableRow key={c.id}>
                                <TableCell>{c.fornecedor ?? "—"}</TableCell>
                                <TableCell>{c.descricao ?? "—"}</TableCell>
                                <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                                <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                                <TableCell>{statusBadge(c.status, pagarBadge)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" onClick={() => abrirModalPagamentoContaPagar(c)}>
                                      <CheckCircle className="h-4 w-4" /> Pago
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => excluirContaPagar(c.id)} title="Excluir" className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="pagas">
                  <Card>
                    <CardHeader><CardTitle>Contas Pagas</CardTitle></CardHeader>
                    <CardContent>
                      {loading ? skeletons() : contasPagarPagas.length === 0 ? (
                        <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Nenhuma conta paga no período.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fornecedor</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Pago em</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {contasPagarPagas.map((c) => (
                              <TableRow key={c.id}>
                                <TableCell>{c.fornecedor ?? "—"}</TableCell>
                                <TableCell>{c.descricao ?? "—"}</TableCell>
                                <TableCell className="font-semibold">{formatCurrency(Number(c.valor))}</TableCell>
                                <TableCell>{formatDate(c.data_pagamento)}</TableCell>
                                <TableCell>{statusBadge(c.status, pagarBadge)}</TableCell>
                                <TableCell className="text-right">
                                  <Button size="icon" variant="ghost" onClick={() => excluirContaPagar(c.id)} title="Excluir" className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>
          )}

          {/* ── COMISSÕES ── */}
          <TabsContent value="comissoes">
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
                              <TableCell>{statusBadge(c.status, comissaoBadge)}</TableCell>
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
                              <TableCell>{statusBadge(c.status, comissaoBadge)}</TableCell>
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
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de recebimento de conta a receber */}
      <Dialog open={!!receberModal} onOpenChange={(open) => { if (!open) setReceberModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
          </DialogHeader>
          {receberModal && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-[var(--text-secondary)]">
                Descrição: <span className="font-medium text-foreground">{receberModal.descricao}</span>
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Valor original: <span className="font-semibold text-foreground">{formatCurrency(receberModal.valorOriginal)}</span>
              </p>
              <div className="space-y-1.5">
                <Label>Valor recebido</Label>
                <CurrencyInput value={receberModalValor} onValueChange={(v) => setReceberModalValor(v ?? 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de recebimento</Label>
                <Input type="date" value={receberModalData} onChange={(e) => setReceberModalData(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Conta bancária</Label>
                {contasBancarias.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Nenhuma conta cadastrada. Cadastre em Configurações → Contas Bancárias.
                  </p>
                ) : (
                  <Select value={receberModalContaId} onChange={(e) => setReceberModalContaId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {contasBancarias.map((cb) => (
                      <option key={cb.id} value={cb.id}>
                        {cb.nome}{cb.banco ? ` · ${cb.banco}` : ""}{cb.principal ? " (Principal)" : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReceberModal(null)} disabled={recebendoConta}>Cancelar</Button>
            <Button
              onClick={confirmarRecebimento}
              disabled={
                recebendoConta
                || !receberModalData
                || receberModalValor <= 0
                || (contasBancarias.length > 0 && !receberModalContaId)
              }
            >
              {recebendoConta ? "Salvando..." : "Confirmar recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de pagamento de conta a pagar */}
      <Dialog open={!!pagarModal} onOpenChange={(open) => { if (!open) setPagarModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {pagarModal && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-[var(--text-secondary)]">
                Fornecedor: <span className="font-medium text-foreground">{pagarModal.fornecedor}</span>
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Descrição: <span className="font-medium text-foreground">{pagarModal.descricao}</span>
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Valor original: <span className="font-semibold text-foreground">{formatCurrency(pagarModal.valorOriginal)}</span>
              </p>
              <div className="space-y-1.5">
                <Label>Valor pago</Label>
                <CurrencyInput value={pagarModalValor} onValueChange={(v) => setPagarModalValor(v ?? 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data do pagamento</Label>
                <Input type="date" value={pagarModalData} onChange={(e) => setPagarModalData(e.target.value)} required />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagarModal(null)} disabled={pagandoConta}>Cancelar</Button>
            <Button onClick={confirmarPagamentoContaPagar} disabled={pagandoConta || !pagarModalData || pagarModalValor <= 0}>
              {pagandoConta ? "Salvando..." : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Modal: editar conta a receber */}
      <Dialog open={editReceberOpen} onOpenChange={setEditReceberOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar conta a receber</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={editRecForm.descricao}
                onChange={(e) => setEditRecForm((p) => ({ ...p, descricao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyInput
                value={editRecForm.valor}
                onValueChange={(v) => setEditRecForm((p) => ({ ...p, valor: v ?? 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={editRecForm.data_vencimento}
                onChange={(e) => setEditRecForm((p) => ({ ...p, data_vencimento: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Status</Label>
              <Select
                value={editRecForm.status}
                onChange={(e) => setEditRecForm((p) => ({ ...p, status: e.target.value as "pendente" | "recebida" }))}
              >
                <option value="pendente">A receber</option>
                <option value="recebida">Recebida</option>
              </Select>
            </div>
            {editRecForm.status === "recebida" && (
              <>
                <div className="space-y-1.5">
                  <Label>Recebido em</Label>
                  <Input
                    type="date"
                    value={editRecForm.data_recebimento}
                    onChange={(e) => setEditRecForm((p) => ({ ...p, data_recebimento: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Conta bancária</Label>
                  {contasBancarias.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)]">
                      Cadastre em Configurações → Contas Bancárias.
                    </p>
                  ) : (
                    <Select
                      value={editRecForm.conta_bancaria_id}
                      onChange={(e) => setEditRecForm((p) => ({ ...p, conta_bancaria_id: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {contasBancarias.map((cb) => (
                        <option key={cb.id} value={cb.id}>
                          {cb.nome}{cb.banco ? ` · ${cb.banco}` : ""}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditReceberOpen(false)} disabled={editandoReceber}>
              Cancelar
            </Button>
            <Button onClick={salvarEditarReceber} disabled={editandoReceber}>
              {editandoReceber ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: adicionar conta a receber */}
      <Dialog open={addReceberOpen} onOpenChange={setAddReceberOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar conta a receber</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={recForm.descricao} onChange={(e) => setRecForm((p) => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyInput value={recForm.valor} onValueChange={(v) => setRecForm((p) => ({ ...p, valor: v ?? 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="date" value={recForm.data_vencimento} onChange={(e) => setRecForm((p) => ({ ...p, data_vencimento: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddReceberOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={criarContaReceber} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: adicionar conta a pagar */}
      <Dialog open={addPagarOpen} onOpenChange={setAddPagarOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar conta a pagar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input value={pagForm.fornecedor} onChange={(e) => setPagForm((p) => ({ ...p, fornecedor: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="date" value={pagForm.data_vencimento} onChange={(e) => setPagForm((p) => ({ ...p, data_vencimento: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={pagForm.descricao} onChange={(e) => setPagForm((p) => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyInput value={pagForm.valor} onValueChange={(v) => setPagForm((p) => ({ ...p, valor: v ?? 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddPagarOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => criarContaPagar("pendente")} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: adicionar conta paga */}
      <Dialog open={addPagasOpen} onOpenChange={setAddPagasOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar conta paga</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              <Input value={pagaForm.fornecedor} onChange={(e) => setPagaForm((p) => ({ ...p, fornecedor: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de pagamento</Label>
              <Input type="date" value={pagaForm.data_pagamento} onChange={(e) => setPagaForm((p) => ({ ...p, data_pagamento: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={pagaForm.descricao} onChange={(e) => setPagaForm((p) => ({ ...p, descricao: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <CurrencyInput value={pagaForm.valor} onValueChange={(v) => setPagaForm((p) => ({ ...p, valor: v ?? 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddPagasOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => criarContaPagar("paga")} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: adicionar comissão manual */}
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
