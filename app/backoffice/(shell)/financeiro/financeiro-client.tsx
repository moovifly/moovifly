"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Plus, RefreshCcw, Trash2 } from "lucide-react";

import { Topbar } from "@/components/backoffice/topbar";
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
import { getSupabaseClient, getSupabasePublicUrl } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { formatCurrency, formatDate } from "@/lib/format";

type ContaReceber = {
  id: string;
  descricao: string | null;
  valor: number | string;
  data_vencimento: string | null;
  data_recebimento?: string | null;
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
type ContaSimplesTransaction = {
  id: string;
  source_path: string;
  description: string | null;
  amount_brl: number | string;
  transaction_date: string;
  transaction_status: string;
  category_name: string | null;
  cost_center_name: string | null;
};
type FinanceConciliation = {
  id: string;
  conta_simples_transaction_id: string;
  status: string;
  reason: string | null;
  match_score: number | string;
  matched_at: string | null;
};
type IntegrationEvent = {
  status: string;
  processed_at: string | null;
  received_at: string;
  event_type: string;
};

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
  const [tab, setTab] = useState("receber");
  const [receber, setReceber] = useState<ContaReceber[]>([]);
  const [pagar, setPagar] = useState<ContaPagar[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [contaSimplesTx, setContaSimplesTx] = useState<ContaSimplesTransaction[]>([]);
  const [conciliacoes, setConciliacoes] = useState<FinanceConciliation[]>([]);
  const [lastIntegrationEvent, setLastIntegrationEvent] = useState<IntegrationEvent | null>(null);
  const [syncingContaSimples, setSyncingContaSimples] = useState(false);
  const [reprocessingConciliacao, setReprocessingConciliacao] = useState(false);
  const [csStatusFilter, setCsStatusFilter] = useState("todos");
  const [csCategoryFilter, setCsCategoryFilter] = useState("todos");
  const [csCostCenterFilter, setCsCostCenterFilter] = useState("todos");
  const [loading, setLoading] = useState(true);

  // Modal de pagamento de comissão
  const [payModal, setPayModal] = useState<{ id: string; nome: string; valor: number } | null>(null);
  const [payDate, setPayDate] = useState("");
  const [paying, setPaying] = useState(false);

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
  const contaSimplesIntegrationEnabled =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_CONTA_SIMPLES_ENABLED === "true";
  const contaSimplesBlockedMessage =
    "Integração aguardando habilitação do provedor (Conta Simples).";

  const PRESETS = [
    {
      key: "hoje",
      label: "Hoje",
      range: () => { const t = new Date().toISOString().slice(0, 10); return { from: t, to: t }; },
    },
    {
      key: "semana",
      label: "Esta semana",
      range: () => {
        const d = new Date();
        const mon = new Date(d);
        mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return { from: mon.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
      },
    },
    {
      key: "mes",
      label: "Este mês",
      range: () => {
        const d = new Date();
        return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
      },
    },
    {
      key: "mes_passado",
      label: "Último mês",
      range: () => {
        const d = new Date();
        return {
          from: new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10),
          to: new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10),
        };
      },
    },
    {
      key: "3meses",
      label: "Últ. 3 meses",
      range: () => {
        const d = new Date(); const from = new Date(d); from.setMonth(d.getMonth() - 3);
        return { from: from.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
      },
    },
    {
      key: "6meses",
      label: "Últ. 6 meses",
      range: () => {
        const d = new Date(); const from = new Date(d); from.setMonth(d.getMonth() - 6);
        return { from: from.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
      },
    },
    {
      key: "ano",
      label: "Este ano",
      range: () => {
        const d = new Date();
        return { from: new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
      },
    },
  ];

  const MAX_DAYS = 90;

  function daysBetween(a: string, b: string) {
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
  }

  function addDays(date: string, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const [activePreset, setActivePreset] = useState("mes");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  function handleDateFromChange(value: string) {
    setActivePreset("");
    let to = dateTo;
    if (daysBetween(value, to) > MAX_DAYS) {
      to = addDays(value, MAX_DAYS);
      toast.info(`Período limitado a ${MAX_DAYS} dias. Data final ajustada.`);
    }
    setDateFrom(value);
    setDateTo(to);
  }

  function handleDateToChange(value: string) {
    setActivePreset("");
    if (daysBetween(dateFrom, value) > MAX_DAYS) {
      toast.error(`O período personalizado não pode ultrapassar ${MAX_DAYS} dias.`);
      setDateTo(addDays(dateFrom, MAX_DAYS));
      return;
    }
    setDateTo(value);
  }

  async function load() {
    setLoading(true);
    try {
      const toTs = dateTo + "T23:59:59";
      const [{ data: rec }, { data: com }, { data: usr }] = await Promise.all([
        supabase.from("contas_receber").select("*").gte("data_vencimento", dateFrom).lte("data_vencimento", dateTo).order("data_vencimento"),
        supabase.from("comissoes").select("*, usuarios(nome), vendas(numero_venda, descricao, data_venda)").gte("created_at", dateFrom).lte("created_at", toTs).order("created_at", { ascending: false }),
        isManager ? supabase.from("usuarios").select("id, nome, tipo").order("nome") : Promise.resolve({ data: [] }),
      ]);
      setReceber((rec ?? []) as ContaReceber[]);
      setComissoes((com ?? []) as unknown as Comissao[]);
      setUsuarios((usr ?? []) as Usuario[]);

      if (isManager) {
        // Pending bills: no date filter (always show all outstanding obligations)
        // Paid bills: filter by due date within the selected period
        const [{ data: pagPendentes }, { data: pagPagas }, { data: csTx }, { data: csConc }, { data: csEvent }] = await Promise.all([
          supabase.from("contas_pagar").select("*").eq("status", "pendente").order("data_vencimento"),
          supabase.from("contas_pagar").select("*").neq("status", "pendente").gte("data_vencimento", dateFrom).lte("data_vencimento", dateTo).order("data_vencimento"),
          supabase
            .from("conta_simples_transactions")
            .select("id, source_path, description, amount_brl, transaction_date, transaction_status, category_name, cost_center_name")
            .gte("transaction_date", `${dateFrom}T00:00:00.000Z`)
            .lte("transaction_date", `${dateTo}T23:59:59.999Z`)
            .order("transaction_date", { ascending: false })
            .limit(500),
          supabase
            .from("finance_conciliations")
            .select("id, conta_simples_transaction_id, status, reason, match_score, matched_at")
            .order("updated_at", { ascending: false })
            .limit(500),
          supabase
            .from("integration_events")
            .select("status, processed_at, received_at, event_type")
            .eq("provider", "conta_simples")
            .order("received_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        setPagar([...(pagPendentes ?? []), ...(pagPagas ?? [])] as ContaPagar[]);
        setContaSimplesTx((csTx ?? []) as ContaSimplesTransaction[]);
        setConciliacoes((csConc ?? []) as FinanceConciliation[]);
        setLastIntegrationEvent((csEvent ?? null) as IntegrationEvent | null);
      } else {
        setPagar([]);
        setContaSimplesTx([]);
        setConciliacoes([]);
        setLastIntegrationEvent(null);
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
    setPayModal({ id: c.id, nome: vendorName(c), valor: Number(c.valor_comissao) });
  }

  async function confirmarPagamentoComissao() {
    if (!payModal || !payDate) return;
    setPaying(true);
    try {
      const { error } = await supabase
        .from("comissoes")
        .update({ status: "paga", data_pagamento: payDate })
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

  async function sincronizarContaSimples() {
    if (!contaSimplesIntegrationEnabled) {
      toast.info("Sincronização indisponível no momento.", {
        description: contaSimplesBlockedMessage,
      });
      return;
    }

    setSyncingContaSimples(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${getSupabasePublicUrl()}/functions/v1/conta-simples-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          startDate: dateFrom,
          endDate: dateTo,
          limit: 100,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao sincronizar Conta Simples.");

      toast.success("Sincronização concluída!", {
        description: `${json.syncedTransactions ?? 0} transações processadas e ${json.reconciledRows ?? 0} conciliações atualizadas.`,
      });
      await load();
      setTab("conta_simples");
    } catch (err) {
      toast.error("Falha na sincronização Conta Simples", { description: formatSupabaseError(err) });
    } finally {
      setSyncingContaSimples(false);
    }
  }

  async function reprocessarConciliacoes() {
    if (!contaSimplesIntegrationEnabled) {
      toast.info("Reprocessamento indisponível no momento.", {
        description: contaSimplesBlockedMessage,
      });
      return;
    }

    setReprocessingConciliacao(true);
    try {
      const { data, error } = await supabase.rpc("reconcile_conta_simples_pending", { p_limit: 200 });
      if (error) throw error;
      toast.success("Reprocessamento concluído.", { description: `${data ?? 0} transações avaliadas.` });
      await load();
    } catch (err) {
      toast.error("Erro ao reprocessar conciliações", { description: formatSupabaseError(err) });
    } finally {
      setReprocessingConciliacao(false);
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

  async function criarContaPagar(status: "pendente" | "pago") {
    setSaving(true);
    try {
      const base = status === "pago" ? pagaForm : pagForm;
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
      toast.success(status === "pago" ? "Conta paga adicionada!" : "Conta a pagar adicionada!");
      if (status === "pago") {
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

      if (!comForm.vendedor_id) {
        toast.error("Selecione um vendedor.");
        return;
      }
      if (!Number.isFinite(valor_venda) || valor_venda < 0) {
        toast.error("Informe o valor da venda.");
        return;
      }
      if (!Number.isFinite(base_calculo) || base_calculo < 0) {
        toast.error("Informe a base de cálculo.");
        return;
      }
      if (!Number.isFinite(percentual) || percentual < 0) {
        toast.error("Informe o percentual de comissão.");
        return;
      }

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
      setComForm({
        vendedor_id: "",
        valor_venda: 0,
        base_calculo: null,
        percentual_comissao: "",
        status: "pendente",
        data_pagamento: "",
      });
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

  const comissoesPendentes = useMemo(() => comissoes.filter((c) => c.status === "pendente"), [comissoes]);
  const comissoesPagas = useMemo(() => comissoes.filter((c) => c.status === "paga"), [comissoes]);
  const contasPagarPendentes = useMemo(() => pagar.filter((c) => c.status === "pendente"), [pagar]);
  const contasPagarPagas = useMemo(() => pagar.filter((c) => c.status === "pago"), [pagar]);
  const conciliacaoByTxId = useMemo(
    () => new Map(conciliacoes.map((item) => [item.conta_simples_transaction_id, item])),
    [conciliacoes],
  );
  const contaSimplesCategories = useMemo(
    () => Array.from(new Set(contaSimplesTx.map((tx) => tx.category_name).filter(Boolean) as string[])).sort(),
    [contaSimplesTx],
  );
  const contaSimplesCostCenters = useMemo(
    () => Array.from(new Set(contaSimplesTx.map((tx) => tx.cost_center_name).filter(Boolean) as string[])).sort(),
    [contaSimplesTx],
  );
  const contaSimplesFiltradas = useMemo(
    () =>
      contaSimplesTx.filter((tx) => {
        const conc = conciliacaoByTxId.get(tx.id);
        const concStatus = conc?.status ?? "pendente";
        if (csStatusFilter !== "todos" && concStatus !== csStatusFilter) return false;
        if (csCategoryFilter !== "todos" && (tx.category_name ?? "Sem categoria") !== csCategoryFilter) return false;
        if (csCostCenterFilter !== "todos" && (tx.cost_center_name ?? "Sem centro de custo") !== csCostCenterFilter) return false;
        return true;
      }),
    [contaSimplesTx, conciliacaoByTxId, csStatusFilter, csCategoryFilter, csCostCenterFilter],
  );
  const conciliacoesPendentesOuDivergentes = useMemo(
    () => conciliacoes.filter((item) => item.status === "pendente" || item.status === "divergente"),
    [conciliacoes],
  );
  const contaSimplesPendentesCount = useMemo(
    () => contaSimplesTx.filter((tx) => (conciliacaoByTxId.get(tx.id)?.status ?? "pendente") !== "conciliada").length,
    [contaSimplesTx, conciliacaoByTxId],
  );
  const contaSimplesDivergentesCount = useMemo(
    () => contaSimplesTx.filter((tx) => (conciliacaoByTxId.get(tx.id)?.status ?? "pendente") === "divergente").length,
    [contaSimplesTx, conciliacaoByTxId],
  );
  const contaSimplesTxById = useMemo(
    () => new Map(contaSimplesTx.map((tx) => [tx.id, tx])),
    [contaSimplesTx],
  );

  function statusBadge(status: string, map: Record<string, string>) {
    return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] ?? "bg-[var(--warning-bg)] text-[var(--warning-text)]"}`}>{status}</span>;
  }

  const receberBadge = { recebido: "bg-[var(--success-bg)] text-[var(--success-text)]", cancelado: "bg-[var(--danger-bg)] text-[var(--danger-text)]" };
  const pagarBadge = { pago: "bg-[var(--success-bg)] text-[var(--success-text)]", cancelado: "bg-[var(--danger-bg)] text-[var(--danger-text)]" };
  const comissaoBadge = { paga: "bg-[var(--success-bg)] text-[var(--success-text)]", cancelada: "bg-[var(--danger-bg)] text-[var(--danger-text)]" };
  const conciliacaoBadge = {
    conciliada: "bg-[var(--success-bg)] text-[var(--success-text)]",
    divergente: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
    pendente: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  };

  return (
    <>
      <Topbar title="Financeiro" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card>
          <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    const { from, to } = p.range();
                    setDateFrom(from);
                    setDateTo(to);
                    setActivePreset(p.key);
                  }}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    activePreset === p.key
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
                <Input type="date" value={dateFrom} onChange={(e) => handleDateFromChange(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Até</Label>
                <Input type="date" value={dateTo} min={dateFrom} max={addDays(dateFrom, MAX_DAYS)} onChange={(e) => handleDateToChange(e.target.value)} />
              </div>
              <p className="pb-1 text-xs text-[var(--text-secondary)]">Máx. {MAX_DAYS} dias no período personalizado</p>
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="receber">A Receber</TabsTrigger>
            {isManager && <TabsTrigger value="pagar">A Pagar</TabsTrigger>}
            {isManager && <TabsTrigger value="pagas">Contas Pagas</TabsTrigger>}
            {isManager && <TabsTrigger value="conta_simples">Conta Simples</TabsTrigger>}
            <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          </TabsList>

          {/* A RECEBER */}
          <TabsContent value="receber">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Contas a Receber</CardTitle>
                {isManager && (
                  <Button size="sm" onClick={() => { setAddReceberOpen(true); setRecForm({ descricao: "", valor: 0, data_vencimento: new Date().toISOString().slice(0, 10) }); }}>
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                )}
              </CardHeader>
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
                            <div className="flex justify-end gap-2">
                              {c.status === "pendente" && (
                                <Button size="sm" variant="outline" onClick={() => marcarRecebido(c.id)}>
                                  <CheckCircle className="h-4 w-4" /> Recebido
                                </Button>
                              )}
                              {isManager && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => excluirContaReceber(c.id)}
                                  title="Excluir"
                                  className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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

          {/* A PAGAR — contas_pagar + comissões pendentes */}
          {isManager && (
            <TabsContent value="pagar">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle>Contas a Pagar</CardTitle>
                    <Button size="sm" onClick={() => { setAddPagarOpen(true); setPagForm({ fornecedor: "", descricao: "", valor: 0, data_vencimento: new Date().toISOString().slice(0, 10) }); }}>
                      <Plus className="h-4 w-4" /> Adicionar
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : contasPagarPendentes.length === 0 ? (
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
                                  <Button size="sm" variant="outline" onClick={() => marcarPago(c.id)}>
                                    <CheckCircle className="h-4 w-4" /> Pago
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => excluirContaPagar(c.id)}
                                    title="Excluir"
                                    className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                                  >
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

                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle>Comissões Pendentes</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setAddComissaoOpen(true)}>
                      <Plus className="h-4 w-4" /> Adicionar comissão
                    </Button>
                  </CardHeader>
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
                            <TableHead>Venda</TableHead>
                            <TableHead>Data da venda</TableHead>
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
                              <TableCell className="text-xs text-muted-foreground">{saleLabel(c)}</TableCell>
                              <TableCell>{saleDate(c)}</TableCell>
                              <TableCell className="font-semibold">{formatCurrency(Number(c.valor_comissao))}</TableCell>
                              <TableCell>{c.percentual_comissao ? `${c.percentual_comissao}%` : "—"}</TableCell>
                              <TableCell>{statusBadge(c.status, comissaoBadge)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => abrirModalPagamentoComissao(c)}>
                                    <CheckCircle className="h-4 w-4" /> Pagar
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => excluirComissao(c.id)}
                                    title="Excluir"
                                    className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                                  >
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
              </div>
            </TabsContent>
          )}

          {/* CONTAS PAGAS — comissões pagas */}
          {isManager && (
            <TabsContent value="pagas">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle>Contas Pagas</CardTitle>
                    <Button size="sm" onClick={() => { setAddPagasOpen(true); setPagaForm({ fornecedor: "", descricao: "", valor: 0, data_pagamento: new Date().toISOString().slice(0, 10) }); }}>
                      <Plus className="h-4 w-4" /> Adicionar
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : contasPagarPagas.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Nenhuma conta paga.</p>
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
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => excluirContaPagar(c.id)}
                                  title="Excluir"
                                  className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                                >
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

                <Card>
                  <CardHeader><CardTitle>Comissões Pagas</CardTitle></CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : comissoesPagas.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Nenhuma comissão paga ainda.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendedor</TableHead>
                            <TableHead>Venda</TableHead>
                            <TableHead>Data da venda</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>%</TableHead>
                            <TableHead>Data de Pagamento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
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
                              <TableCell className="text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => excluirComissao(c.id)}
                                  title="Excluir"
                                  className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                                >
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
              </div>
            </TabsContent>
          )}

          {/* CONTA SIMPLES — sync e conciliação */}
          {isManager && (
            <TabsContent value="conta_simples">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle>Integração Conta Simples</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={reprocessarConciliacoes}
                        disabled={!contaSimplesIntegrationEnabled || reprocessingConciliacao || loading}
                      >
                        <RefreshCcw className={`h-4 w-4 ${reprocessingConciliacao ? "animate-spin" : ""}`} />
                        {reprocessingConciliacao ? "Reprocessando..." : "Reprocessar conciliações"}
                      </Button>
                      <Button
                        onClick={sincronizarContaSimples}
                        disabled={!contaSimplesIntegrationEnabled || syncingContaSimples || loading}
                      >
                        <RefreshCcw className={`h-4 w-4 ${syncingContaSimples ? "animate-spin" : ""}`} />
                        {syncingContaSimples ? "Sincronizando..." : "Sincronizar agora"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-4">
                    {!contaSimplesIntegrationEnabled && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 md:col-span-4 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                        {contaSimplesBlockedMessage}
                      </div>
                    )}
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-[var(--text-secondary)]">Transações no período</p>
                      <p className="text-xl font-semibold">{contaSimplesTx.length}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-[var(--text-secondary)]">Pendentes de conciliação</p>
                      <p className="text-xl font-semibold">{contaSimplesPendentesCount}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-[var(--text-secondary)]">Divergentes</p>
                      <p className="text-xl font-semibold">{contaSimplesDivergentesCount}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-[var(--text-secondary)]">Último processamento</p>
                      <p className="text-sm font-medium">
                        {lastIntegrationEvent?.processed_at
                          ? formatDate(lastIntegrationEvent.processed_at)
                          : lastIntegrationEvent?.received_at
                          ? formatDate(lastIntegrationEvent.received_at)
                          : "Ainda não sincronizado"}
                      </p>
                      {lastIntegrationEvent?.status && (
                        <div className="mt-1">
                          {statusBadge(
                            lastIntegrationEvent.status,
                            {
                              processed: "bg-[var(--success-bg)] text-[var(--success-text)]",
                              failed: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
                              pending: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
                              ignored: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
                            },
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Filtros de conciliação</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Status da conciliação</Label>
                      <Select value={csStatusFilter} onChange={(e) => setCsStatusFilter(e.target.value)}>
                        <option value="todos">Todos</option>
                        <option value="pendente">Pendente</option>
                        <option value="conciliada">Conciliada</option>
                        <option value="divergente">Divergente</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Categoria</Label>
                      <Select value={csCategoryFilter} onChange={(e) => setCsCategoryFilter(e.target.value)}>
                        <option value="todos">Todas</option>
                        <option value="Sem categoria">Sem categoria</option>
                        {contaSimplesCategories.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Centro de custo</Label>
                      <Select value={csCostCenterFilter} onChange={(e) => setCsCostCenterFilter(e.target.value)}>
                        <option value="todos">Todos</option>
                        <option value="Sem centro de custo">Sem centro de custo</option>
                        {contaSimplesCostCenters.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Transações Conta Simples</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : contaSimplesFiltradas.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Nenhuma transação encontrada para os filtros selecionados.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Centro de custo</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status integração</TableHead>
                            <TableHead>Status conciliação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contaSimplesFiltradas.map((tx) => {
                            const conc = conciliacaoByTxId.get(tx.id);
                            const concStatus = conc?.status ?? "pendente";
                            return (
                              <TableRow key={tx.id}>
                                <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                                <TableCell>{tx.description ?? "—"}</TableCell>
                                <TableCell>{tx.category_name ?? "Sem categoria"}</TableCell>
                                <TableCell>{tx.cost_center_name ?? "Sem centro de custo"}</TableCell>
                                <TableCell className="text-xs text-[var(--text-secondary)]">{tx.source_path}</TableCell>
                                <TableCell className="font-semibold">{formatCurrency(Number(tx.amount_brl))}</TableCell>
                                <TableCell>{statusBadge(tx.transaction_status, { concluida: "bg-[var(--success-bg)] text-[var(--success-text)]", pendente: "bg-[var(--warning-bg)] text-[var(--warning-text)]" })}</TableCell>
                                <TableCell>{statusBadge(concStatus, conciliacaoBadge)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Conciliações pendentes/divergentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : conciliacoesPendentesOuDivergentes.length === 0 ? (
                      <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Sem pendências de conciliação.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead>Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {conciliacoesPendentesOuDivergentes.map((c) => {
                            const tx = contaSimplesTxById.get(c.conta_simples_transaction_id);
                            return (
                              <TableRow key={c.id}>
                                <TableCell>{tx ? formatDate(tx.transaction_date) : "—"}</TableCell>
                                <TableCell>{tx?.description ?? "Transação não encontrada"}</TableCell>
                                <TableCell>{tx ? formatCurrency(Number(tx.amount_brl)) : "—"}</TableCell>
                                <TableCell>{statusBadge(c.status, conciliacaoBadge)}</TableCell>
                                <TableCell className="text-xs text-[var(--text-secondary)]">{c.reason ?? "Sem detalhe"}</TableCell>
                                <TableCell>{Number(c.match_score).toFixed(0)}%</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* COMISSÕES — histórico completo */}
          <TabsContent value="comissoes">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Comissões</CardTitle>
                {isManager && (
                  <Button size="sm" onClick={() => setAddComissaoOpen(true)}>
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                )}
              </CardHeader>
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
                        <TableHead>Venda</TableHead>
                        <TableHead>Data da venda</TableHead>
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
                          <TableCell className="text-xs text-muted-foreground">{saleLabel(c)}</TableCell>
                          <TableCell>{saleDate(c)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(Number(c.valor_comissao))}</TableCell>
                          <TableCell>{c.percentual_comissao ? `${c.percentual_comissao}%` : "—"}</TableCell>
                          <TableCell>{statusBadge(c.status, comissaoBadge)}</TableCell>
                          <TableCell>{c.data_pagamento ? formatDate(c.data_pagamento) : "—"}</TableCell>
                          {isManager && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {c.status === "pendente" && (
                                  <Button size="sm" variant="outline" onClick={() => abrirModalPagamentoComissao(c)}>
                                    <CheckCircle className="h-4 w-4" /> Pagar
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => excluirComissao(c.id)}
                                  title="Excluir"
                                  className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                                >
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
            <Button onClick={() => criarContaPagar("pago")} disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
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
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
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
