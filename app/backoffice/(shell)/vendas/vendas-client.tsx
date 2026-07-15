"use client";

import { CreditCard, Eye, Pencil, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { BackofficeLink } from "@/components/backoffice/backoffice-link";
import { EmptyState } from "@/components/backoffice/empty-state";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Autocomplete } from "@/components/autocomplete";
import { showConfirm } from "@/components/confirm-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { ROLE_LABELS } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate, getInitials } from "@/lib/format";
import { normalizeDateOnly } from "@/lib/date-only";
import { loadAeroportos, searchAeroportos, type Aeroporto, loadCompanhias, searchCompanhias, type Companhia } from "@/lib/datasets";
import { emptyVoo, parseVoosFromObservacoes, parseVoosJson, voosToVendaCampos, type Voo } from "@/lib/voos";
import { VoosFormSection } from "@/components/backoffice/voos-form-section";

type Passageiro = {
  nome: string;
  documento: string;
  data_nascimento: string;
};

type Venda = {
  id: string;
  numero_venda: string;
  cliente_id: string | null;
  vendedor_id: string | null;
  categoria_venda: "aereo" | "seguro_viagem" | null;
  tipo: string | null;
  origem: string | null;
  destino: string | null;
  companhia: string | null;
  localizador: string | null;
  voucher: string | null;
  data_ida: string | null;
  data_volta: string | null;
  data_venda: string;
  valor_total: number | string;
  taxa_rav: number | string;
  taxa_du: number | string;
  comissao_percentual: number | string;
  status: string;
  forma_pagamento: string | null;
  fornecedor: string | null;
  observacoes?: string | null;
  voos?: Voo[] | null;
  passageiros_dados?: Passageiro[] | null;
  cliente?: { nome: string } | null;
  vendedor?: { nome: string } | null;
};

type Cliente = { id: string; nome: string };

type UsuarioSimples = {
  id: string;
  nome: string;
  tipo: string;
  comissao_percentual: number | null;
  comissao_seguro_percentual: number | null;
};

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", variant: "warning" as const },
  { value: "confirmada", label: "Confirmada", variant: "success" as const },
  { value: "concluida", label: "Concluída", variant: "default" as const },
  { value: "cancelada", label: "Cancelada", variant: "destructive" as const },
];

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** Mesmos presets de período usados em Relatórios e Dashboard. */
const PERIOD_PRESETS: { key: string; label: string; range: () => { from: string; to: string } }[] = [
  { key: "hoje", label: "Hoje", range: () => { const t = dateOnly(new Date()); return { from: t, to: t }; } },
  { key: "semana", label: "Esta semana", range: () => { const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { from: dateOnly(mon), to: dateOnly(d) }; } },
  { key: "mes", label: "Este mês", range: () => { const d = new Date(); return { from: dateOnly(new Date(d.getFullYear(), d.getMonth(), 1)), to: dateOnly(d) }; } },
  { key: "mes_passado", label: "Último mês", range: () => { const d = new Date(); return { from: dateOnly(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: dateOnly(new Date(d.getFullYear(), d.getMonth(), 0)) }; } },
  { key: "3meses", label: "Últ. 3 meses", range: () => { const d = new Date(); const from = new Date(d); from.setMonth(d.getMonth() - 3); return { from: dateOnly(from), to: dateOnly(d) }; } },
  { key: "6meses", label: "Últ. 6 meses", range: () => { const d = new Date(); const from = new Date(d); from.setMonth(d.getMonth() - 6); return { from: dateOnly(from), to: dateOnly(d) }; } },
  { key: "ano", label: "Este ano", range: () => { const d = new Date(); return { from: dateOnly(new Date(d.getFullYear(), 0, 1)), to: dateOnly(d) }; } },
];

const TIPO_OPTIONS = ["passagem", "pacote", "hospedagem", "corporativo", "lua-de-mel", "grupo", "outros"];

const FORNECEDOR_OPTIONS = [
  "BRT", "MaisFly", "GTA",
];

const FORMA_PAGAMENTO_OPTIONS = [
  "À vista",
  "Parcelado Cartão de Crédito",
  "1x Cartão de Crédito",
  "Pix + Cartão de Crédito",
];

const FORMAS_CARTAO = new Set(["1x Cartão de Crédito", "Parcelado Cartão de Crédito", "Pix + Cartão de Crédito"]);

const TAXA_CARTAO_MAP: Record<string, number> = {
  "BRT": 3.99,
  "MaisFly": 3.99,
};

function formaPagamentoSelectOptions(current: string): string[] {
  const v = current.trim();
  if (v && !FORMA_PAGAMENTO_OPTIONS.includes(v)) {
    return [v, ...FORMA_PAGAMENTO_OPTIONS];
  }
  return FORMA_PAGAMENTO_OPTIONS;
}

function calcComissaoSeguro(valorTotal: number, percentualVendedor: number) {
  const repasseFornecedor = Math.round(valorTotal * 40) / 100;
  const comissaoVendedor = Math.round(repasseFornecedor * percentualVendedor) / 100;
  return { repasseFornecedor, comissaoVendedor, percentualVendedor };
}

const emptyPassageiro = (): Passageiro => ({ nome: "", documento: "", data_nascimento: "" });

type FormState = {
  id: string | null;
  categoria_venda: "aereo" | "seguro_viagem";
  cliente_id: string | null;
  cliente_nome: string;
  tipo: string;
  origem: string;
  destino: string;
  companhia: string;
  localizador: string;
  data_ida: string;
  data_volta: string;
  data_venda: string;
  valor_total: number;
  taxa_rav: number;
  taxa_du: number;
  status: string;
  forma_pagamento: string;
  fornecedor: string;
  voucher: string;
  passageiros_dados: Passageiro[];
  voos: Voo[];
  atribuido_a: string | null;
};

const emptyForm = (): FormState => ({
  id: null,
  categoria_venda: "aereo",
  cliente_id: null,
  cliente_nome: "",
  tipo: "passagem",
  origem: "",
  destino: "",
  companhia: "",
  localizador: "",
  data_ida: "",
  data_volta: "",
  data_venda: new Date().toISOString().slice(0, 10),
  valor_total: 0,
  taxa_rav: 0,
  taxa_du: 0,
  status: "pendente",
  forma_pagamento: "",
  fornecedor: "",
  voucher: "",
  passageiros_dados: [emptyPassageiro()],
  voos: [emptyVoo("ida")],
  atribuido_a: null,
});

export function VendasClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const isAdminOrGerente = profile?.tipo === "administrador" || profile?.tipo === "gerente";
  const [items, setItems] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSimples[]>([]);
  const [aeroportos, setAeroportos] = useState<Aeroporto[]>([]);
  const [companhias, setCompanhias] = useState<Companhia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activePreset, setActivePreset] = useState<string>("mes");
  const [dateFrom, setDateFrom] = useState(() => PERIOD_PRESETS.find((p) => p.key === "mes")!.range().from);
  const [dateTo, setDateTo] = useState(() => PERIOD_PRESETS.find((p) => p.key === "mes")!.range().to);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select-type" | "form">("select-type");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [activeTab, setActiveTab] = useState<"dados" | "passageiros">("dados");
  const [viewMode, setViewMode] = useState(false);

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("vendas")
        .select("*, cliente:clientes(nome), vendedor:usuarios(nome)")
        .order("created_at", { ascending: false });
      if (profile?.tipo === "vendedor") q = q.eq("vendedor_id", profile.id);
      const { data, error } = await q;
      if (error) throw error;
      setItems((data ?? []) as unknown as Venda[]);

      const { data: cliData } = await supabase.from("clientes").select("id, nome").eq("status", "ativo").order("nome");
      setClientes((cliData ?? []) as Cliente[]);

      if (profile?.tipo === "administrador" || profile?.tipo === "gerente") {
        const { data: usrData } = await supabase
          .from("usuarios")
          .select("id, nome, tipo, comissao_percentual, comissao_seguro_percentual")
          .eq("ativo", true)
          .order("nome");
        setUsuarios((usrData ?? []) as UsuarioSimples[]);
      }
    } catch (err) {
      toast.error("Erro ao carregar vendas", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    loadAeroportos().then(setAeroportos).catch(() => undefined);
    loadCompanhias().then(setCompanhias);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((v) => {
      const cli = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
      const matchesTerm = !term || (cli?.nome ?? "").toLowerCase().includes(term) || (v.numero_venda ?? "").toLowerCase().includes(term) || (v.destino ?? "").toLowerCase().includes(term);
      const matchesStatus = !statusFilter || v.status === statusFilter;
      const matchesDate = (!dateFrom || v.data_venda >= dateFrom) && (!dateTo || v.data_venda <= dateTo);
      return matchesTerm && matchesStatus && matchesDate;
    });
  }, [items, search, statusFilter, dateFrom, dateTo]);

  const filteredSummary = useMemo(
    () => ({
      count: filtered.length,
      total: filtered.reduce((sum, v) => sum + Number(v.valor_total ?? 0), 0),
    }),
    [filtered],
  );

  function openNew() { setForm({ ...emptyForm(), atribuido_a: profile?.id ?? null }); setStep("select-type"); setActiveTab("dados"); setViewMode(false); setOpen(true); }

  function selectCategoria(cat: "aereo" | "seguro_viagem") {
    setForm((prev) => ({ ...prev, categoria_venda: cat }));
    setActiveTab("dados");
    setStep("form");
  }

  function voosFromVenda(v: Venda): Voo[] {
    const parsed = parseVoosJson(v.voos);
    if (parsed.length) return parsed;
    const fromObs = parseVoosFromObservacoes(v.observacoes);
    if (fromObs.length) return fromObs;
    if (v.categoria_venda === "seguro_viagem") return [];
    return [{
      ...emptyVoo("ida"),
      origem: v.origem ?? "",
      destino: v.destino ?? "",
      data_partida: v.data_ida ?? "",
      data_chegada: v.data_ida ?? "",
      companhia: v.companhia ?? "",
    }];
  }

  function openEdit(v: Venda) {
    const cli = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
    setForm({
      id: v.id,
      categoria_venda: v.categoria_venda ?? "aereo",
      cliente_id: v.cliente_id,
      cliente_nome: cli?.nome ?? "",
      tipo: v.tipo ?? "passagem",
      origem: v.origem ?? "",
      destino: v.destino ?? "",
      companhia: v.companhia ?? "",
      localizador: v.localizador ?? "",
      data_ida: v.data_ida ?? "",
      data_volta: v.data_volta ?? "",
      data_venda: v.data_venda ?? new Date().toISOString().slice(0, 10),
      valor_total: Number(v.valor_total ?? 0),
      taxa_rav: Number(v.taxa_rav ?? 0),
      taxa_du: Number(v.taxa_du ?? 0),
      status: v.status,
      forma_pagamento: v.forma_pagamento ?? "",
      fornecedor: v.fornecedor ?? "",
      voucher: v.voucher ?? "",
      passageiros_dados: (v.passageiros_dados && v.passageiros_dados.length > 0)
        ? v.passageiros_dados
        : [emptyPassageiro()],
      voos: voosFromVenda(v),
      atribuido_a: v.vendedor_id ?? null,
    });
    setViewMode(false);
    setActiveTab("dados");
    setStep("form");
    setOpen(true);
  }

  function openView(v: Venda) {
    const cli = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
    setForm({
      id: v.id,
      categoria_venda: v.categoria_venda ?? "aereo",
      cliente_id: v.cliente_id,
      cliente_nome: cli?.nome ?? "",
      tipo: v.tipo ?? "passagem",
      origem: v.origem ?? "",
      destino: v.destino ?? "",
      companhia: v.companhia ?? "",
      localizador: v.localizador ?? "",
      data_ida: v.data_ida ?? "",
      data_volta: v.data_volta ?? "",
      data_venda: v.data_venda ?? new Date().toISOString().slice(0, 10),
      valor_total: Number(v.valor_total ?? 0),
      taxa_rav: Number(v.taxa_rav ?? 0),
      taxa_du: Number(v.taxa_du ?? 0),
      status: v.status,
      forma_pagamento: v.forma_pagamento ?? "",
      fornecedor: v.fornecedor ?? "",
      voucher: v.voucher ?? "",
      passageiros_dados: (v.passageiros_dados && v.passageiros_dados.length > 0)
        ? v.passageiros_dados
        : [emptyPassageiro()],
      voos: voosFromVenda(v),
      atribuido_a: v.vendedor_id ?? null,
    });
    setViewMode(true);
    setActiveTab("dados");
    setStep("form");
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { toast.error("Selecione um cliente."); return; }
    if (!form.valor_total || form.valor_total <= 0) { toast.error("Informe um valor total válido."); return; }
    setSaving(true);
    try {
      const isSeguro = form.categoria_venda === "seguro_viagem";
      const camposVoo = isSeguro ? null : voosToVendaCampos(form.voos);
      const descricao = isSeguro
        ? ["Seguro Viagem", form.destino].filter(Boolean).join(" — ") || "Seguro Viagem"
        : [form.tipo, (camposVoo?.origem || form.origem) && (camposVoo?.destino || form.destino)
            ? `${camposVoo?.origem || form.origem} → ${camposVoo?.destino || form.destino}`
            : camposVoo?.destino || form.destino || camposVoo?.origem || form.origem]
            .filter(Boolean)
            .join(" — ") || "Venda";
      const passageirosValidos = form.passageiros_dados.filter((p) => p.nome.trim());
      const payload = {
        categoria_venda: form.categoria_venda,
        cliente_id: form.cliente_id,
        vendedor_id: isAdminOrGerente ? (form.atribuido_a ?? profile?.id ?? null) : (profile?.id ?? null),
        tipo: isSeguro ? null : form.tipo || null,
        descricao,
        origem: isSeguro ? null : camposVoo?.origem || form.origem || null,
        destino: form.destino || camposVoo?.destino || null,
        companhia: isSeguro ? null : camposVoo?.companhia || form.companhia || null,
        localizador: isSeguro ? null : form.localizador.trim() || null,
        data_ida: isSeguro ? null : camposVoo?.data_ida || normalizeDateOnly(form.data_ida) || null,
        data_volta: isSeguro ? null : camposVoo?.data_volta || normalizeDateOnly(form.data_volta) || null,
        data_venda: form.data_venda,
        valor_total: form.valor_total,
        taxa_rav: isSeguro ? 0 : form.taxa_rav,
        taxa_du: isSeguro ? 0 : form.taxa_du,
        status: form.status,
        forma_pagamento: form.forma_pagamento || null,
        fornecedor: isSeguro ? null : form.fornecedor || null,
        voucher: isSeguro ? form.voucher || null : null,
        passageiros_dados: passageirosValidos.length > 0 ? passageirosValidos : null,
        passageiros: Math.max(passageirosValidos.length, 1),
        voos: isSeguro ? [] : form.voos,
      };
      if (form.id) {
        const { error } = await supabase.from("vendas").update(payload).eq("id", form.id);
        if (error) throw error;

        // Recalculate commission using same logic as comissaoPreview
        if (isSeguro && form.valor_total > 0) {
          const userAtribuido = isAdminOrGerente && form.atribuido_a
            ? usuarios.find(u => u.id === form.atribuido_a)
            : null;
          const percentualSeguro = Number(
            userAtribuido?.comissao_seguro_percentual ?? (profile as { comissao_seguro_percentual?: number } | null)?.comissao_seguro_percentual ?? 0
          );
          const { repasseFornecedor, comissaoVendedor } = calcComissaoSeguro(form.valor_total, percentualSeguro);
          await supabase
            .from("comissoes")
            .update({ base_calculo: repasseFornecedor, percentual_comissao: percentualSeguro, valor_comissao: comissaoVendedor })
            .eq("venda_id", form.id)
            .eq("status", "pendente");
        } else if (!isSeguro) {
          const base = (payload.taxa_rav ?? 0) + (payload.taxa_du ?? 0);
          if (base > 0) {
            const userAtribuido = isAdminOrGerente && form.atribuido_a
              ? usuarios.find(u => u.id === form.atribuido_a)
              : null;
            const percentualVendedor = Number(
              userAtribuido?.comissao_percentual ?? (profile as { comissao_percentual?: number } | null)?.comissao_percentual ?? 0
            );
            let baseComissao = base;
            const temTaxaCartao = FORMAS_CARTAO.has(payload.forma_pagamento ?? "") && (payload.fornecedor ?? "") in TAXA_CARTAO_MAP;
            if (temTaxaCartao) {
              const taxaPct = TAXA_CARTAO_MAP[payload.fornecedor!];
              const taxaCartaoVal = Math.round(base * taxaPct) / 100;
              baseComissao = Math.round((base - taxaCartaoVal) * 100) / 100;
            }
            const novaComissao = percentualVendedor > 0 ? Math.round(baseComissao * percentualVendedor) / 100 : 0;
            await supabase
              .from("comissoes")
              .update({ base_calculo: baseComissao, percentual_comissao: percentualVendedor, valor_comissao: novaComissao })
              .eq("venda_id", form.id)
              .eq("status", "pendente");
          }
        }

        toast.success("Venda atualizada!");
      } else {
        const { error } = await supabase.from("vendas").insert([payload]);
        if (error) throw error;
        toast.success("Venda cadastrada!");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(form.id ? "Erro ao atualizar venda" : "Erro ao cadastrar venda", {
        description: formatSupabaseError(err),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v: Venda) {
    const ok = await showConfirm({ title: "Excluir venda", message: `Excluir venda #${v.numero_venda}?`, destructive: true, confirmText: "Excluir" });
    if (!ok) return;
    try {
      const { error } = await supabase.from("vendas").delete().eq("id", v.id);
      if (error) throw error;
      toast.success("Venda excluída.");
      await load();
    } catch (err) {
      toast.error("Erro ao excluir", { description: formatSupabaseError(err) });
    }
  }

  const f =
    (key: Exclude<keyof FormState, "valor_total" | "taxa_rav" | "taxa_du" | "passageiros_dados">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  function handleCompanhiaSelect(c: Companhia) {
    setForm((prev) => ({ ...prev, companhia: c.nome }));
  }

  function handleVooCompanhiaSelect(i: number, c: Companhia) {
    setForm((prev) => ({
      ...prev,
      companhia: prev.companhia || c.nome,
      voos: prev.voos.map((v, idx) => (idx === i ? { ...v, companhia: c.nome } : v)),
    }));
  }

  function addPassageiro() {
    setForm((p) => ({ ...p, passageiros_dados: [...p.passageiros_dados, emptyPassageiro()] }));
  }

  function removePassageiro(index: number) {
    setForm((p) => ({ ...p, passageiros_dados: p.passageiros_dados.filter((_, i) => i !== index) }));
  }

  function updatePassageiro(index: number, field: keyof Passageiro, value: string) {
    setForm((p) => ({
      ...p,
      passageiros_dados: p.passageiros_dados.map((pax, i) =>
        i === index ? { ...pax, [field]: value } : pax
      ),
    }));
  }

  const passageirosPreenchidos = form.passageiros_dados.filter((p) => p.nome.trim()).length;

  const comissaoPreview = useMemo(() => {
    if (form.categoria_venda === "seguro_viagem") {
      if (!form.valor_total || form.valor_total <= 0) return null;
      const userAtribuido = isAdminOrGerente && form.atribuido_a
        ? usuarios.find(u => u.id === form.atribuido_a)
        : null;
      const percentualSeguro = Number(
        userAtribuido?.comissao_seguro_percentual ?? (profile as { comissao_seguro_percentual?: number } | null)?.comissao_seguro_percentual ?? 0
      );
      const nomeAtribuido = userAtribuido?.nome ?? null;
      const { repasseFornecedor, comissaoVendedor, percentualVendedor } = calcComissaoSeguro(form.valor_total, percentualSeguro);
      return {
        isSeguro: true as const,
        valorTotal: form.valor_total,
        repasseFornecedor,
        comissaoVendedor,
        percentualVendedor,
        nomeAtribuido,
      };
    }
    const base = (form.taxa_rav || 0) + (form.taxa_du || 0);
    if (base <= 0) return null;
    const userAtribuido = isAdminOrGerente && form.atribuido_a
      ? usuarios.find(u => u.id === form.atribuido_a)
      : null;
    const percentualVendedor = Number(
      userAtribuido?.comissao_percentual ?? (profile as { comissao_percentual?: number } | null)?.comissao_percentual ?? 0
    );
    const nomeAtribuido = userAtribuido?.nome ?? null;
    let taxaCartaoVal = 0;
    let baseComissao = base;
    const temTaxaCartao = FORMAS_CARTAO.has(form.forma_pagamento) && form.fornecedor in TAXA_CARTAO_MAP;
    if (temTaxaCartao) {
      const taxaPct = TAXA_CARTAO_MAP[form.fornecedor];
      taxaCartaoVal = Math.round(base * taxaPct) / 100;
      baseComissao = Math.round((base - taxaCartaoVal) * 100) / 100;
    }
    const comissaoVendedor = percentualVendedor > 0 ? Math.round(baseComissao * percentualVendedor) / 100 : null;
    return { isSeguro: false as const, base, taxaCartaoVal, baseComissao, comissaoVendedor, percentualVendedor, temTaxaCartao, nomeAtribuido };
  }, [form.categoria_venda, form.valor_total, form.taxa_rav, form.taxa_du, form.forma_pagamento, form.fornecedor, form.atribuido_a, profile, usuarios, isAdminOrGerente]);

  return (
    <>
      <Topbar
        title="Vendas"
        subtitle={`${filtered.length} venda${filtered.length !== 1 ? "s" : ""}`}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" />Nova Venda</Button>}
      />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader className="flex-col gap-3 space-y-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Lista de Vendas</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, número..." className="pl-10 sm:w-72" />
                </div>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44">
                  <option value="">Todos status</option>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    const { from, to } = p.range();
                    setDateFrom(from);
                    setDateTo(to);
                    setActivePreset(p.key);
                  }}
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors sm:py-1.5 ${
                    activePreset === p.key
                      ? "border-[var(--accent-600)] bg-[var(--accent-600)] text-white shadow-[var(--shadow-xs)]"
                      : "border-[var(--border-subtle)] bg-card text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <div className="min-w-[140px] flex-1 space-y-1.5 sm:min-w-0 sm:flex-none">
                <Label className="text-xs">De</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setActivePreset(""); }}
                  className="w-full sm:w-40"
                />
              </div>
              <div className="min-w-[140px] flex-1 space-y-1.5 sm:min-w-0 sm:flex-none">
                <Label className="text-xs">Até</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setActivePreset(""); }}
                  className="w-full sm:w-40"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Nenhuma venda encontrada"
                description="Ajuste os filtros ou o período selecionado."
              />
            ) : (
              <>
              {/* Lista mobile: cards com dados-chave e as mesmas ações da tabela */}
              <div className="space-y-3 md:hidden">
                {filtered.map((v) => {
                  const cli = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
                  const sb = STATUS_OPTIONS.find((s) => s.value === v.status) ?? STATUS_OPTIONS[0];
                  const isSeguro = v.categoria_venda === "seguro_viagem";
                  return (
                    <div key={v.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{cli?.nome ?? "—"}</p>
                          <p className="font-mono text-xs text-[var(--text-secondary)]">
                            #{v.numero_venda} · {formatDate(v.data_venda)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(Number(v.valor_total))}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)]">
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                        <Badge variant={isSeguro ? "info" : "default"}>{isSeguro ? "Seguro" : "Aéreo"}</Badge>
                        {v.destino && <span className="min-w-0 truncate">{v.destino}</span>}
                        {v.localizador?.trim() && <span className="font-mono uppercase">{v.localizador.trim()}</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-1 border-t border-[var(--border-subtle)] pt-2">
                        <BackofficeLink href={`/backoffice/checkout/?id=${v.id}`}>
                          <Button variant="ghost" size="icon" className="h-11 w-11" title="Checkout"><CreditCard className="h-4 w-4" /></Button>
                        </BackofficeLink>
                        <Button variant="ghost" size="icon" className="h-11 w-11" title="Visualizar" onClick={() => openView(v)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-11 w-11" title="Editar" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(v)} className="h-11 w-11 text-destructive hover:bg-(--danger-bg)"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  );
                })}
                <p className="pt-1 text-right text-sm font-semibold">
                  {filteredSummary.count} Venda{filteredSummary.count !== 1 ? "s" : ""} - Total {formatCurrency(filteredSummary.total)}
                </p>
              </div>
              {/* Tabela (md+) */}
              <div className="hidden md:block">
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="hidden lg:table-cell">Localizador</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden text-center xl:table-cell">Vendedor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => {
                    const cli = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
                    const sb = STATUS_OPTIONS.find((s) => s.value === v.status) ?? STATUS_OPTIONS[0];
                    const isSeguro = v.categoria_venda === "seguro_viagem";
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                        <TableCell>{formatDate(v.data_venda)}</TableCell>
                        <TableCell className="font-medium">{cli?.nome ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={isSeguro ? "info" : "default"}>
                            {isSeguro ? "Seguro" : "Aéreo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{v.destino ?? "—"}</TableCell>
                        <TableCell className="hidden font-mono text-xs uppercase lg:table-cell">{v.localizador?.trim() || "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(Number(v.valor_total))}</TableCell>
                        <TableCell><Badge variant={sb.variant}>{sb.label}</Badge></TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {(() => {
                            const ven = Array.isArray(v.vendedor) ? v.vendedor[0] : v.vendedor;
                            if (!ven?.nome) return null;
                            return (
                              <div className="flex justify-center">
                                <Avatar className="h-7 w-7" title={ven.nome}>
                                  <AvatarFallback className="text-[10px]">{getInitials(ven.nome)}</AvatarFallback>
                                </Avatar>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <BackofficeLink href={`/backoffice/checkout/?id=${v.id}`}>
                              <Button variant="ghost" size="icon" title="Checkout"><CreditCard className="h-4 w-4" /></Button>
                            </BackofficeLink>
                            <Button variant="ghost" size="icon" title="Visualizar" onClick={() => openView(v)}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(v)} className="text-destructive hover:bg-(--danger-bg)"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2 bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={10} className="py-3 text-right font-semibold">
                      {filteredSummary.count} Venda{filteredSummary.count !== 1 ? "s" : ""} - Total {formatCurrency(filteredSummary.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setViewMode(false); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {step === "select-type" ? (
            <>
              <DialogHeader>
                <DialogTitle>Nova venda</DialogTitle>
                <DialogDescription>Escolha o tipo de venda para continuar.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2 sm:gap-4">
                <button
                  type="button"
                  onClick={() => selectCategoria("aereo")}
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 text-center transition-colors hover:border-primary hover:bg-accent"
                >
                  <span className="text-4xl">✈️</span>
                  <span className="text-base font-semibold">Aéreo</span>
                  <span className="text-xs text-muted-foreground">Passagens, pacotes e hospedagens</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectCategoria("seguro_viagem")}
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 text-center transition-colors hover:border-primary hover:bg-accent"
                >
                  <span className="text-4xl">🛡️</span>
                  <span className="text-base font-semibold">Seguro Viagem</span>
                  <span className="text-xs text-muted-foreground">Venda Seguro Viagem</span>
                </button>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {viewMode
                    ? "Detalhes da Venda"
                    : form.id
                    ? "Editar venda"
                    : form.categoria_venda === "seguro_viagem"
                    ? "Nova venda — Seguro Viagem"
                    : "Nova venda — Aéreo"}
                </DialogTitle>
                <DialogDescription>
                  {viewMode
                    ? `${form.categoria_venda === "seguro_viagem" ? "Seguro Viagem" : "Aéreo"} · somente leitura`
                    : form.categoria_venda === "seguro_viagem"
                    ? "Preencha os dados do seguro viagem."
                    : "Preencha os dados da venda aérea."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSave} className="space-y-4">
                <fieldset disabled={viewMode} className="space-y-4 disabled:opacity-70">
                <div className="space-y-1.5">
                  <Label>Cliente {viewMode ? "" : "*"}</Label>
                  <Autocomplete
                    value={form.cliente_nome}
                    onValueChange={(text) => setForm((f) => ({ ...f, cliente_nome: text, cliente_id: null }))}
                    onSelect={(opt) => setForm((f) => ({ ...f, cliente_nome: opt.label, cliente_id: (opt.value as Cliente).id }))}
                    options={clientes.filter((c) => c.nome.toLowerCase().includes(form.cliente_nome.toLowerCase())).map((c) => ({ value: c, label: c.nome }))}
                    placeholder="Digite o nome do cliente..."
                  />
                </div>

                {isAdminOrGerente && usuarios.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Atribuir venda a</Label>
                    <Select
                      value={form.atribuido_a ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, atribuido_a: e.target.value || null }))}
                      disabled={viewMode}
                    >
                      <option value="">Sem atribuição</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome} ({ROLE_LABELS[u.tipo] ?? u.tipo})
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                </fieldset>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "dados" | "passageiros")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="dados" className="flex-1">Dados da Venda</TabsTrigger>
                    <TabsTrigger value="passageiros" className="flex-1">
                      Passageiros{passageirosPreenchidos > 0 ? ` (${passageirosPreenchidos})` : ""}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="dados">
                    {form.categoria_venda === "seguro_viagem" ? (
                      <fieldset disabled={viewMode} className="disabled:opacity-70">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Destino</Label>
                          <Input value={form.destino} onChange={f("destino")} placeholder="Ex: Lisboa, Portugal" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Data de ida</Label>
                          <Input type="date" value={form.data_ida} onChange={f("data_ida")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Data de volta</Label>
                          <Input type="date" value={form.data_volta} onChange={f("data_volta")} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Voucher</Label>
                          <Input value={form.voucher} onChange={f("voucher")} placeholder="Número ou código do voucher" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Valor total (R$) *</Label>
                          <CurrencyInput value={form.valor_total} onValueChange={(v) => setForm((p) => ({ ...p, valor_total: v ?? 0 }))} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Forma de pagamento</Label>
                          <Select value={form.forma_pagamento} onChange={f("forma_pagamento")}>
                            <option value="">Selecione...</option>
                            {formaPagamentoSelectOptions(form.forma_pagamento).map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Status</Label>
                          <Select value={form.status} onChange={f("status")}>
                            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Data da venda *</Label>
                          <Input type="date" value={form.data_venda} onChange={f("data_venda")} required />
                        </div>
                      </div>
                      </fieldset>
                    ) : (
                      <fieldset disabled={viewMode} className="disabled:opacity-70">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Tipo</Label>
                          <Select value={form.tipo} onChange={f("tipo")}>
                            {TIPO_OPTIONS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Data da venda *</Label>
                          <Input type="date" value={form.data_venda} onChange={f("data_venda")} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Origem</Label>
                          <Autocomplete
                            value={form.origem}
                            onValueChange={(t) => setForm((p) => ({ ...p, origem: t }))}
                            onSelect={(opt) => setForm((p) => ({ ...p, origem: `${(opt.value as Aeroporto).codigo} - ${(opt.value as Aeroporto).cidade}` }))}
                            options={searchAeroportos(form.origem, aeroportos).map((a) => ({ value: a, label: `${a.codigo} - ${a.cidade}`, description: `${a.nome}, ${a.pais}` }))}
                            placeholder="Aeroporto de origem"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Destino</Label>
                          <Autocomplete
                            value={form.destino}
                            onValueChange={(t) => setForm((p) => ({ ...p, destino: t }))}
                            onSelect={(opt) => setForm((p) => ({ ...p, destino: `${(opt.value as Aeroporto).codigo} - ${(opt.value as Aeroporto).cidade}` }))}
                            options={searchAeroportos(form.destino, aeroportos).map((a) => ({ value: a, label: `${a.codigo} - ${a.cidade}`, description: `${a.nome}, ${a.pais}` }))}
                            placeholder="Aeroporto de destino"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Companhia aérea</Label>
                          <Autocomplete
                            value={form.companhia}
                            onValueChange={(t) => setForm((p) => ({ ...p, companhia: t }))}
                            onSelect={(opt) => handleCompanhiaSelect(opt.value as Companhia)}
                            options={searchCompanhias(form.companhia, companhias).map((c) => ({ value: c, label: c.nome, description: `${c.codigo} · ${c.pais}` }))}
                            placeholder="LATAM, GOL, Azul..."
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Localizador (LOC)</Label>
                          <Input
                            value={form.localizador}
                            onChange={f("localizador")}
                            placeholder="Número do localizador do voo"
                            className="uppercase"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Data de ida</Label>
                          <Input type="date" value={form.data_ida} onChange={f("data_ida")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Data de volta</Label>
                          <Input type="date" value={form.data_volta} onChange={f("data_volta")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Valor total (R$) *</Label>
                          <CurrencyInput value={form.valor_total} onValueChange={(v) => setForm((p) => ({ ...p, valor_total: v ?? 0 }))} required />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Taxa RAV (R$)</Label>
                          <CurrencyInput value={form.taxa_rav} onValueChange={(v) => setForm((p) => ({ ...p, taxa_rav: v ?? 0 }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Taxa DU (R$)</Label>
                          <CurrencyInput value={form.taxa_du} onValueChange={(v) => setForm((p) => ({ ...p, taxa_du: v ?? 0 }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Status</Label>
                          <Select value={form.status} onChange={f("status")}>
                            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Forma de pagamento</Label>
                          <Select value={form.forma_pagamento} onChange={f("forma_pagamento")}>
                            <option value="">Selecione...</option>
                            {formaPagamentoSelectOptions(form.forma_pagamento).map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Fornecedor</Label>
                          <Select value={form.fornecedor} onChange={f("fornecedor")}>
                            <option value="">Selecione...</option>
                            {FORNECEDOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </Select>
                        </div>
                      </div>
                      <VoosFormSection
                        voos={form.voos}
                        onChange={(voos) => setForm((p) => ({ ...p, voos }))}
                        aeroportos={aeroportos}
                        companhias={companhias}
                        disabled={viewMode}
                        onCompanhiaSelect={handleVooCompanhiaSelect}
                      />
                      </fieldset>
                    )}

                    {comissaoPreview && (
                      <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm mt-4">
                        {comissaoPreview.isSeguro ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Repasse fornecedor (40%)</span>
                              <span className="font-medium">{formatCurrency(comissaoPreview.repasseFornecedor)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1.5">
                              <span className="text-muted-foreground">
                                {comissaoPreview.nomeAtribuido && comissaoPreview.nomeAtribuido !== profile?.nome
                                  ? `Comissão de ${comissaoPreview.nomeAtribuido} (${comissaoPreview.percentualVendedor}% do repasse)`
                                  : `Comissão vendedor (${comissaoPreview.percentualVendedor}% do repasse)`}
                              </span>
                              <span className="font-semibold text-primary">{formatCurrency(comissaoPreview.comissaoVendedor)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">RAV + DU</span>
                              <span className="font-medium">{formatCurrency(comissaoPreview.base)}</span>
                            </div>
                            {comissaoPreview.temTaxaCartao && (
                              <div className="flex justify-between text-destructive">
                                <span>TX Cartão ({form.fornecedor})</span>
                                <span>− {formatCurrency(comissaoPreview.taxaCartaoVal)}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t pt-1.5">
                              <span className="text-muted-foreground">Total Comissão</span>
                              <span className="font-semibold">{formatCurrency(comissaoPreview.baseComissao)}</span>
                            </div>
                            {comissaoPreview.comissaoVendedor !== null && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {comissaoPreview.nomeAtribuido && comissaoPreview.nomeAtribuido !== profile?.nome
                                    ? `Comissão de ${comissaoPreview.nomeAtribuido} (${comissaoPreview.percentualVendedor}%)`
                                    : `Sua Comissão (${comissaoPreview.percentualVendedor}%)`}
                                </span>
                                <span className="font-semibold text-primary">{formatCurrency(comissaoPreview.comissaoVendedor)}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="passageiros">
                      <div className="space-y-3">
                        <fieldset disabled={viewMode} className="space-y-3 disabled:opacity-70">
                        {form.passageiros_dados.map((p, i) => (
                          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold">Passageiro {i + 1}</span>
                              {!viewMode && form.passageiros_dados.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removePassageiro(i)}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-(--danger-bg) hover:text-destructive sm:h-7 sm:w-7"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5 sm:col-span-2">
                                <Label>Nome Completo</Label>
                                <Input
                                  value={p.nome}
                                  onChange={(e) => updatePassageiro(i, "nome", e.target.value)}
                                  placeholder="Nome completo do passageiro"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>CPF / Passaporte</Label>
                                <Input
                                  value={p.documento}
                                  onChange={(e) => updatePassageiro(i, "documento", e.target.value)}
                                  placeholder="000.000.000-00"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Data de Nascimento</Label>
                                <Input
                                  type="date"
                                  value={p.data_nascimento}
                                  onChange={(e) => updatePassageiro(i, "data_nascimento", e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        </fieldset>
                        {!viewMode && (
                          <Button type="button" variant="outline" onClick={addPassageiro} className="w-full gap-2">
                            <Plus className="h-4 w-4" />
                            Adicionar Passageiro
                          </Button>
                        )}
                      </div>
                  </TabsContent>
                </Tabs>

                <DialogFooter>
                  {viewMode ? (
                    <>
                      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
                      <Button type="button" onClick={() => setViewMode(false)}>Editar</Button>
                    </>
                  ) : (
                    <>
                      {!form.id && (
                        <Button type="button" variant="ghost" onClick={() => setStep("select-type")} disabled={saving}>Voltar</Button>
                      )}
                      <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
                      <Button type="submit" disabled={saving}>{saving ? "Salvando..." : form.id ? "Atualizar" : "Cadastrar"}</Button>
                    </>
                  )}
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
