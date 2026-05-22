"use client";

import { FilePlus, FileText, Pencil, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Autocomplete } from "@/components/autocomplete";
import { showConfirm } from "@/components/confirm-modal";
import { BolsaMochilaIcon, MalaGrandeIcon, MalaMaoIcon } from "@/components/icons/bagagem";
import { WhatsAppIcon } from "@/components/icons/whatsapp";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { formatCurrency, formatDate } from "@/lib/format";
import { normalizeDateOnly, toLocalDateOnlyString } from "@/lib/date-only";
import { loadAeroportos, loadCompanhias, searchAeroportos, searchCompanhias, type Aeroporto, type Companhia } from "@/lib/datasets";
import { downloadOrcamentoPdf } from "@/lib/orcamento-pdf";
import { getFormaPagamento } from "@/lib/financiamento";

type Voo = {
  tipo: "ida" | "volta";
  origem: string;
  destino: string;
  data_partida: string;
  horario_saida: string;
  data_chegada: string;
  horario_chegada: string;
  companhia: string;
  numero_voo: string;
};

type Orcamento = {
  id: string;
  numero_orcamento?: string | null;
  cliente_id: string | null;
  vendedor_id: string | null;
  venda_id?: string | null;
  convertido_venda?: boolean | null;
  data_orcamento: string;
  tipo_viagem?: "nacional" | "internacional" | string | null;
  adultos: number;
  criancas: number;
  bebes: number;
  com_bagagem: boolean;
  bagagens?: { bolsa?: number; mao?: number; grande?: number } | null;
  voos: Voo[];
  valor_total: number | string;
  rav_du?: number | string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  status: string;
  cliente?: { id: string; nome: string } | null;
  vendedor?: { id: string; nome: string } | null;
};

type ContatoEditForm = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  observacoes: string;
  status: string;
};

type FormState = {
  id: string | null;
  cliente_id: string | null;
  cliente_nome: string;
  lead_telefone: string;
  data_orcamento: string;
  tipo_viagem: "nacional" | "internacional";
  adultos: number;
  criancas: number;
  bebes: number;
  com_bagagem: boolean;
  bagagens: { bolsa: number; mao: number; grande: number };
  voos: Voo[];
  valor_total: number;
  rav_du: number;
  forma_pagamento: string;
  observacoes: string;
  status: string;
};

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", variant: "warning" as const },
  { value: "enviado", label: "Enviado", variant: "info" as const },
  { value: "aprovado", label: "Aprovado", variant: "success" as const },
  { value: "recusado", label: "Recusado", variant: "destructive" as const },
  { value: "convertido", label: "Convertido", variant: "default" as const },
];

const PAGAMENTO_PADRAO =
  "Em até 4x sem juros, nos cartões Amex, Diners, Elo, Hipercard, Mastercard e Visa, Pix ou transferência bancária.";

function firstName(fullName: string | null | undefined) {
  const n = (fullName ?? "").trim();
  if (!n) return "—";
  return n.split(/\s+/)[0] ?? n;
}

function voosToVendaCampos(voovs: Voo[] | undefined) {
  const idas = voovs?.filter((v) => v.tipo === "ida") ?? [];
  const voltas = voovs?.filter((v) => v.tipo === "volta") ?? [];
  const firstIda = idas[0];
  const lastIda = idas.at(-1);
  const lastVolta = voltas.at(-1);
  return {
    origem: firstIda?.origem?.trim() || null,
    destino: lastIda?.destino?.trim() || null,
    data_ida: normalizeDateOnly(firstIda?.data_partida) || null,
    data_volta: normalizeDateOnly(lastVolta?.data_partida) || normalizeDateOnly(voltas[0]?.data_partida) || null,
    companhia: firstIda?.companhia?.trim() || null,
  };
}

function formatVoosParaObservacao(voovs: Voo[] | undefined): string {
  if (!voovs?.length) return "";
  let nIda = 0;
  let nVolta = 0;
  return voovs
    .map((v) => {
      const trecho = v.tipo === "ida" ? "Ida" : "Volta";
      const idx = v.tipo === "ida" ? ++nIda : ++nVolta;
      const parts = [
        `${trecho} #${idx}: ${v.origem?.trim() || "—"} → ${v.destino?.trim() || "—"}`,
        v.data_partida ? `Partida ${v.data_partida}` : null,
        v.data_chegada && v.data_chegada !== v.data_partida ? `Chegada ${v.data_chegada}` : null,
        [v.horario_saida, v.horario_chegada].filter(Boolean).length ? `Saída/chegada ${v.horario_saida || "—"} / ${v.horario_chegada || "—"}` : null,
        [v.companhia, v.numero_voo].filter(Boolean).join(" ").trim() || null,
      ].filter(Boolean);
      return parts.join(" | ");
    })
    .join("\n");
}

const VENDA_FORMA_PAGAMENTO_MAX = 100;
const VENDA_DESTINO_MAX = 255;
const VENDA_DESCRICAO_MAX = 500;

function clipVarchar(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

/** Normaliza linha do Postgres (tem_bagagem / formas_pagamento) para o modelo do formulário. */
function migrateVoo(v: Record<string, unknown>): Voo {
  // backward compat: registros antigos têm 'data', novos têm 'data_partida' + 'data_chegada'
  const legacyData = (v.data as string | undefined) ?? "";
  return {
    tipo: ((v.tipo as string) === "volta" ? "volta" : "ida") as "ida" | "volta",
    origem: (v.origem as string) ?? "",
    destino: (v.destino as string) ?? "",
    data_partida: (v.data_partida as string | undefined) ?? legacyData,
    horario_saida: (v.horario_saida as string) ?? "",
    data_chegada: (v.data_chegada as string | undefined) ?? legacyData,
    horario_chegada: (v.horario_chegada as string) ?? "",
    companhia: (v.companhia as string) ?? "",
    numero_voo: (v.numero_voo as string) ?? "",
  };
}

function rowToOrcamento(raw: Record<string, unknown>): Orcamento {
  const bagagensRaw = raw.bagagens;
  const bagagens =
    bagagensRaw && typeof bagagensRaw === "object"
      ? (bagagensRaw as { bolsa?: number; mao?: number; grande?: number })
      : null;
  const voosRaw = Array.isArray(raw.voos)
    ? (raw.voos as Record<string, unknown>[]).map(migrateVoo)
    : [];
  return {
    ...(raw as unknown as Orcamento),
    com_bagagem: Boolean(raw.tem_bagagem ?? raw.com_bagagem),
    forma_pagamento: (raw.formas_pagamento ?? raw.forma_pagamento) as string | null,
    tipo_viagem: (raw.tipo_viagem as string | null) ?? "nacional",
    bagagens,
    voos: voosRaw,
  };
}

const emptyForm = (): FormState => ({
  id: null,
  cliente_id: null,
  cliente_nome: "",
  lead_telefone: "",
  data_orcamento: new Date().toISOString().slice(0, 10),
  tipo_viagem: "nacional",
  adultos: 1,
  criancas: 0,
  bebes: 0,
  com_bagagem: true,
  bagagens: { bolsa: 1, mao: 1, grande: 1 },
  voos: [{ tipo: "ida", origem: "", destino: "", data_partida: "", horario_saida: "", data_chegada: "", horario_chegada: "", companhia: "", numero_voo: "" }],
  valor_total: 0,
  rav_du: 0,
  forma_pagamento: PAGAMENTO_PADRAO,
  observacoes: "",
  status: "pendente",
});

function clampInt(n: number, { min, max }: { min: number; max: number }) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function normalizeBagagens(input: Partial<FormState["bagagens"]> | null | undefined): FormState["bagagens"] {
  const bolsa = clampInt(Number(input?.bolsa ?? 0), { min: 0, max: 9 });
  const mao = clampInt(Number(input?.mao ?? 0), { min: 0, max: 9 });
  const grande = clampInt(Number(input?.grande ?? 0), { min: 0, max: 9 });
  return { bolsa, mao, grande };
}

function temAlgumaBagagem(b: FormState["bagagens"]) {
  return (b.bolsa ?? 0) + (b.mao ?? 0) + (b.grande ?? 0) > 0;
}

function descricaoBagagens(b: FormState["bagagens"]) {
  const parts: string[] = [];
  if (b.grande) parts.push(`${b.grande} mala${b.grande === 1 ? "" : "s"} grande${b.grande === 1 ? "" : "s"} (até 23kg)`);
  if (b.mao) parts.push(`${b.mao} mala${b.mao === 1 ? "" : "s"} de mão`);
  if (b.bolsa) parts.push(`${b.bolsa} bolsa/mochila`);
  return parts.length ? parts.join(" + ") : "Sem bagagem incluída neste orçamento.";
}

function phoneToWaMe(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function buildWhatsappUrl(
  o: Orcamento,
  clientesTelefones: { id: string; telefone: string | null }[],
): string | null {
  const telefone = clientesTelefones.find((c) => c.id === o.cliente_id)?.telefone ?? null;
  const waNum = phoneToWaMe(telefone);
  if (!waNum) return null;

  const numero = o.numero_orcamento ?? `#${o.id.slice(0, 6)}`;
  const clienteNome = o.cliente?.nome ? firstName(o.cliente.nome) : "cliente";
  const voosIda = o.voos?.filter((v) => v.tipo === "ida") ?? [];
  const trechos = voosIda.length
    ? voosIda.map((v) => `${v.origem || "—"} → ${v.destino || "—"}`).join(", ")
    : null;
  const dataVoo = voosIda[0]?.data_partida ? formatDate(voosIda[0].data_partida) : null;
  const valor = formatCurrency(Number(o.valor_total));
  const pax = `${o.adultos}A · ${o.criancas}C · ${o.bebes}B`;

  const linhas = [
    `Olá ${clienteNome}! Segue o orçamento ${numero} que preparei para você:`,
    "",
    trechos ? `Trecho: ${trechos}` : null,
    dataVoo ? `Data de ida: ${dataVoo}` : null,
    `Passageiros: ${pax}`,
    `Valor total: ${valor}`,
    o.forma_pagamento ? `Pagamento: ${o.forma_pagamento}` : null,
    "",
    "O PDF com todos os detalhes está em anexo. Qualquer duvida, estou a disposicao!",
  ].filter((l): l is string => l !== null);

  return `https://wa.me/${waNum}?text=${encodeURIComponent(linhas.join("\n"))}`;
}

export function OrcamentosClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [aeroportos, setAeroportos] = useState<Aeroporto[]>([]);
  const [companhias, setCompanhias] = useState<Companhia[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [editContatoOpen, setEditContatoOpen] = useState(false);
  const [editContatoForm, setEditContatoForm] = useState<ContatoEditForm | null>(null);
  const [savingContato, setSavingContato] = useState(false);

  async function ensureRelations(o: Orcamento) {
    const clienteId = o.cliente_id;
    const vendedorId = o.vendedor_id;
    const needsCli = clienteId && !o.cliente;
    const needsVen = vendedorId && !o.vendedor;
    if (!needsCli && !needsVen) return o;

    const [{ data: cliRel }, { data: venRel }] = await Promise.all([
      needsCli ? supabase.from("clientes").select("id, nome").eq("id", clienteId).maybeSingle() : Promise.resolve({ data: null as { id: string; nome: string } | null }),
      needsVen ? supabase.from("usuarios").select("id, nome").eq("id", vendedorId).maybeSingle() : Promise.resolve({ data: null as { id: string; nome: string } | null }),
    ]);

    return {
      ...o,
      cliente: o.cliente ?? (cliRel ? { id: cliRel.id, nome: cliRel.nome } : null),
      vendedor: o.vendedor ?? (venRel ? { id: venRel.id, nome: venRel.nome } : null),
    };
  }

  async function gerarPdf(oRaw: Orcamento) {
    try {
      const o = await ensureRelations(oRaw);
      const numero = o.numero_orcamento ?? `#${o.id.slice(0, 6)}`;
      const clienteNome = o.cliente?.nome ?? "—";

      const bagagens = normalizeBagagens(
        o.bagagens ?? (o.com_bagagem ? { bolsa: 1, mao: 1, grande: 1 } : { bolsa: 0, mao: 0, grande: 0 }),
      );
      await downloadOrcamentoPdf(
        {
          numero_orcamento: o.numero_orcamento ?? undefined,
          data_orcamento: o.data_orcamento,
          tipo_viagem: (o.tipo_viagem === "internacional" ? "internacional" : "nacional") as "nacional" | "internacional",
          adultos: o.adultos ?? 0,
          criancas: o.criancas ?? 0,
          bebes: o.bebes ?? 0,
          com_bagagem: temAlgumaBagagem(bagagens),
          bagagens,
          voos: o.voos ?? [],
          valor_total: o.valor_total,
          forma_pagamento: o.forma_pagamento,
          observacoes: o.observacoes,
        },
        `Orcamento-${numero.replace(/[^\w\-#]+/g, "_")}-${firstName(clienteNome)}.pdf`,
      );
      toast.success("PDF gerado!");
    } catch (err) {
      toast.error("Não foi possível gerar o PDF", { description: formatSupabaseError(err) });
    }
  }

  useEffect(() => {
    loadAeroportos().then(setAeroportos).catch(() => undefined);
    loadCompanhias().then(setCompanhias).catch(() => undefined);
  }, []);

  async function load() {
    setLoading(true);
    try {
      let qCli = supabase.from("clientes").select("id, nome, telefone").eq("status", "ativo").order("nome");
      if (profile?.tipo === "vendedor") qCli = qCli.eq("vendedor_id", profile.id);
      const { data: cliData } = await qCli;
      setClientes((cliData ?? []) as { id: string; nome: string; telefone: string | null }[]);

      let q = supabase.from("orcamentos").select("*").order("data_orcamento", { ascending: false });
      if (profile?.tipo === "vendedor") q = q.eq("vendedor_id", profile.id);

      const { data: orcs, error } = await q;
      if (error) throw error;

      const rawOrcs = (orcs ?? []) as Record<string, unknown>[];
      const list = rawOrcs.map(rowToOrcamento);
      const clienteIds = [...new Set(list.map((o: Orcamento) => o.cliente_id).filter(Boolean))] as string[];
      const vendedorIds = [...new Set(list.map((o: Orcamento) => o.vendedor_id).filter(Boolean))] as string[];

      const [{ data: cliRel }, { data: vendRel }] = await Promise.all([
        clienteIds.length ? supabase.from("clientes").select("id, nome").in("id", clienteIds) : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
        vendedorIds.length ? supabase.from("usuarios").select("id, nome").in("id", vendedorIds) : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
      ]);

      const cliMap = new Map((cliRel ?? []).map((c: { id: string; nome: string }) => [c.id, c]));
      const venMap = new Map((vendRel ?? []).map((v: { id: string; nome: string }) => [v.id, v]));

      setItems(
        list.map((o: Orcamento) => ({
          ...o,
          cliente: o.cliente_id ? ((cliMap.get(o.cliente_id) ?? null) as { id: string; nome: string } | null) : null,
          vendedor: o.vendedor_id ? ((venMap.get(o.vendedor_id) ?? null) as { id: string; nome: string } | null) : null,
        })),
      );

    } catch (err) {
      toast.error("Erro ao carregar orçamentos", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((o) => {
      const matchesTerm = !term || o.cliente?.nome.toLowerCase().includes(term) || (o.numero_orcamento ?? "").toLowerCase().includes(term);
      const matchesStatus = !statusFilter || o.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [items, search, statusFilter]);

  function openNew() { setForm(emptyForm()); setOpen(true); }

  function openEdit(o: Orcamento) {
    const bagagens = normalizeBagagens(
      o.bagagens ?? (o.com_bagagem ? { bolsa: 1, mao: 1, grande: 1 } : { bolsa: 0, mao: 0, grande: 0 }),
    );
    setForm({
      id: o.id,
      cliente_id: o.cliente_id,
      cliente_nome: o.cliente?.nome ?? "",
      lead_telefone: "",
      data_orcamento: o.data_orcamento.slice(0, 10),
      tipo_viagem: (o.tipo_viagem === "internacional" ? "internacional" : "nacional") as "nacional" | "internacional",
      adultos: o.adultos ?? 1,
      criancas: o.criancas ?? 0,
      bebes: o.bebes ?? 0,
      com_bagagem: temAlgumaBagagem(bagagens),
      bagagens,
      voos: o.voos?.length ? o.voos : emptyForm().voos,
      valor_total: Number(o.valor_total ?? 0),
      rav_du: Number(o.rav_du ?? 0),
      forma_pagamento: o.forma_pagamento ?? PAGAMENTO_PADRAO,
      observacoes: o.observacoes ?? "",
      status: o.status ?? "pendente",
    });
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.cliente_nome.trim()) { toast.error("Informe o nome do lead."); return; }
    if (!profile?.id) { toast.error("Sessão inválida. Faça login novamente."); return; }
    if (!form.valor_total || form.valor_total <= 0) { toast.error("Informe um valor total maior que zero."); return; }
    setSaving(true);
    try {
      const bagagensNorm = normalizeBagagens(form.bagagens);
      const comBagagem = temAlgumaBagagem(bagagensNorm);

      let clienteId = form.cliente_id;
      let novoContatoCriado = false;
      if (!form.id && !clienteId) {
        const { data: novoCliente, error: cliErr } = await supabase
          .from("clientes")
          .insert([{
            nome: form.cliente_nome.trim(),
            telefone: form.lead_telefone.trim() || null,
            status: "ativo",
            vendedor_id: profile.id,
          }])
          .select("id")
          .single();
        if (cliErr) throw cliErr;
        clienteId = novoCliente.id;
        novoContatoCriado = true;
      }

      const payload = {
        cliente_id: clienteId,
        vendedor_id: profile.id,
        data_orcamento: form.data_orcamento,
        tipo_viagem: form.tipo_viagem,
        adultos: form.adultos,
        criancas: form.criancas,
        bebes: form.bebes,
        tem_bagagem: comBagagem,
        bagagens: bagagensNorm,
        descricao_bagagem: descricaoBagagens(bagagensNorm),
        voos: form.voos,
        valor_total: form.valor_total,
        rav_du: form.rav_du,
        formas_pagamento: form.forma_pagamento.trim() || "",
        observacoes: form.observacoes.trim() || null,
        status: form.status,
      };
      if (form.id) {
        const { error } = await supabase.from("orcamentos").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Orçamento atualizado!");
      } else {
        const { data: inserted, error } = await supabase.from("orcamentos").insert([payload]).select("*").single();
        if (error) throw error;
        const cliIdFinal = clienteId;
        toast.success("Orçamento cadastrado!", {
          description: novoContatoCriado ? "Contato criado. Edite para adicionar mais informações." : undefined,
          action: cliIdFinal ? { label: "Editar contato", onClick: () => openEditContato(cliIdFinal) } : undefined,
          duration: 8000,
        });
        if (inserted) {
          const created = rowToOrcamento(inserted as unknown as Record<string, unknown>);
          await gerarPdf({
            ...created,
            cliente: clienteId ? { id: clienteId, nome: form.cliente_nome || "—" } : null,
            vendedor: profile?.id ? { id: profile.id, nome: profile?.nome ?? "—" } : null,
          });
        }
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error("Erro ao salvar", { description: formatSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  }

  async function openEditContato(id: string) {
    try {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
      if (error) throw error;
      setEditContatoForm({
        id: data.id,
        nome: data.nome ?? "",
        email: data.email ?? "",
        telefone: data.telefone ?? "",
        cpf: data.cpf ?? "",
        rg: data.rg ?? "",
        data_nascimento: data.data_nascimento ?? "",
        endereco: data.endereco ?? "",
        cidade: data.cidade ?? "",
        estado: data.estado ?? "",
        cep: data.cep ?? "",
        observacoes: data.observacoes ?? "",
        status: data.status ?? "ativo",
      });
      setEditContatoOpen(true);
    } catch (err) {
      toast.error("Não foi possível carregar o contato", { description: formatSupabaseError(err) });
    }
  }

  async function handleSaveContato(e: FormEvent) {
    e.preventDefault();
    if (!editContatoForm) return;
    if (!editContatoForm.nome.trim()) { toast.error("Informe o nome do contato."); return; }
    setSavingContato(true);
    try {
      const { error } = await supabase.from("clientes").update({
        nome: editContatoForm.nome.trim(),
        email: editContatoForm.email || null,
        telefone: editContatoForm.telefone || null,
        cpf: editContatoForm.cpf || null,
        rg: editContatoForm.rg || null,
        data_nascimento: editContatoForm.data_nascimento || null,
        endereco: editContatoForm.endereco || null,
        cidade: editContatoForm.cidade || null,
        estado: editContatoForm.estado || null,
        cep: editContatoForm.cep || null,
        observacoes: editContatoForm.observacoes || null,
        status: editContatoForm.status,
      }).eq("id", editContatoForm.id);
      if (error) throw error;
      toast.success("Contato atualizado!");
      setEditContatoOpen(false);
      setEditContatoForm(null);
      await load();
    } catch (err) {
      toast.error("Erro ao salvar contato", { description: formatSupabaseError(err) });
    } finally {
      setSavingContato(false);
    }
  }

  function podeGerarVenda(o: Orcamento) {
    if (!o.cliente_id) return false;
    if (o.status === "convertido" || o.status === "recusado") return false;
    if (o.convertido_venda || o.venda_id) return false;
    return true;
  }

  async function handleGerarVenda(o: Orcamento) {
    if (!podeGerarVenda(o)) return;
    if (!profile?.id) { toast.error("Sessão inválida. Faça login novamente."); return; }
    const ok = await showConfirm({
      title: "Gerar venda",
      message: `Criar uma venda a partir do orçamento ${o.numero_orcamento ?? o.id.slice(0, 8)}? O orçamento será marcado como convertido.`,
      confirmText: "Gerar venda",
    });
    if (!ok) return;
    setConvertingId(o.id);
    try {
      const { origem: origemRaw, destino: destinoRaw, data_ida, data_volta, companhia: companhiaRaw } = voosToVendaCampos(o.voos);
      const origem = origemRaw ? clipVarchar(origemRaw, VENDA_DESTINO_MAX) : null;
      const destino = destinoRaw ? clipVarchar(destinoRaw, VENDA_DESTINO_MAX) : null;
      const companhia = companhiaRaw ? clipVarchar(companhiaRaw, VENDA_DESTINO_MAX) : null;
      const fpFull = (o.forma_pagamento ?? "").trim();
      const formaPagamentoVenda = fpFull ? clipVarchar(fpFull, VENDA_FORMA_PAGAMENTO_MAX) : null;
      const numOrc = o.numero_orcamento?.trim();
      const dataOrcamento = o.data_orcamento?.slice(0, 10);
      const voosTexto = formatVoosParaObservacao(o.voos);
      const paxLine = `Passageiros (orçamento): ${o.adultos ?? 0} adulto(s), ${o.criancas ?? 0} criança(s), ${o.bebes ?? 0} bebê(s).`;
      const bagLine = o.com_bagagem ? "Bagagem: com bagagem (conforme orçamento)." : "Bagagem: sem bagagem (conforme orçamento).";
      let observacoes = o.observacoes?.trim() ?? "";
      if (fpFull.length > VENDA_FORMA_PAGAMENTO_MAX) {
        const nota = `Formas de pagamento (texto completo): ${fpFull}`;
        observacoes = observacoes ? `${observacoes}\n\n${nota}` : nota;
      }
      const blocosExtras = [
        numOrc ? `Referência: orçamento ${numOrc}.` : null,
        dataOrcamento ? `Data do orçamento: ${dataOrcamento}.` : null,
        voosTexto ? `Detalhe dos voos:\n${voosTexto}` : null,
        paxLine,
        bagLine,
      ].filter(Boolean);
      if (blocosExtras.length) {
        observacoes = observacoes ? `${observacoes}\n\n${blocosExtras.join("\n\n")}` : blocosExtras.join("\n\n");
      }
      const passageiros = Math.max(1, (o.adultos ?? 0) + (o.criancas ?? 0) + (o.bebes ?? 0));
      const dataVenda = toLocalDateOnlyString(new Date());
      const descricaoVenda = clipVarchar(
        [
          numOrc ? `Orç. ${numOrc}` : null,
          origem && destino ? `${origem} – ${destino}` : destino || origem || null,
        ]
          .filter(Boolean)
          .join(" · ") || "Passagem (orçamento)",
        VENDA_DESCRICAO_MAX,
      );
      const payload = {
        orcamento_id: o.id,
        cliente_id: o.cliente_id,
        vendedor_id: o.vendedor_id ?? profile.id,
        categoria_venda: "aereo",
        tipo: "passagem",
        descricao: descricaoVenda,
        origem,
        destino,
        data_ida: data_ida || null,
        data_volta: data_volta || null,
        data_venda: dataVenda,
        passageiros,
        companhia,
        valor_total: Number(o.valor_total),
        taxa_rav: 0,
        taxa_du: 0,
        comissao_percentual: 0,
        status: "pendente",
        forma_pagamento: formaPagamentoVenda,
        observacoes: observacoes.trim() || null,
      };
      const { data: inserted, error: insErr } = await supabase.from("vendas").insert([payload]).select("id, numero_venda").maybeSingle();
      if (insErr) throw insErr;
      if (!inserted?.id) throw new Error("Resposta da venda sem id.");
      const { error: updErr } = await supabase
        .from("orcamentos")
        .update({ status: "convertido", convertido_venda: true, venda_id: inserted.id })
        .eq("id", o.id);
      if (updErr) throw updErr;
      const vendaNumero = inserted?.numero_venda;
      toast.success("Venda criada!", {
        description: vendaNumero ? `Número: ${vendaNumero}` : undefined,
        action: { label: "Ver Venda", onClick: () => router.push("/backoffice/vendas") },
        duration: 8000,
      });
      await load();
    } catch (err) {
      toast.error("Não foi possível gerar a venda", { description: formatSupabaseError(err) });
    } finally {
      setConvertingId(null);
    }
  }

  async function handleDelete(o: Orcamento) {
    const numero = o.numero_orcamento ?? "#" + o.id.slice(0, 6);
    const msg =
      o.status === "convertido" || o.venda_id || o.convertido_venda
        ? `Excluir orçamento ${numero}? A venda gerada a partir dele continua cadastrada; apenas o vínculo com este orçamento será removido.`
        : `Excluir orçamento ${numero}?`;
    const ok = await showConfirm({ title: "Excluir orçamento", message: msg, destructive: true, confirmText: "Excluir" });
    if (!ok) return;
    try {
      const { error } = await supabase.from("orcamentos").delete().eq("id", o.id);
      if (error) throw error;
      toast.success("Orçamento excluído.");
      await load();
    } catch (err) {
      toast.error("Erro ao excluir", { description: formatSupabaseError(err) });
    }
  }

  function handleWhatsapp(o: Orcamento) {
    const url = buildWhatsappUrl(o, clientes);
    if (!url) {
      toast.warning("Telefone não cadastrado", {
        description: "Adicione o telefone do cliente para enviar pelo WhatsApp.",
      });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function addVoo(tipo: "ida" | "volta") {
    setForm((f) => ({ ...f, voos: [...f.voos, { tipo, origem: "", destino: "", data_partida: "", horario_saida: "", data_chegada: "", horario_chegada: "", companhia: "", numero_voo: "" }] }));
  }

  function removeVoo(i: number) { setForm((f) => ({ ...f, voos: f.voos.filter((_, idx) => idx !== i) })); }

  function updateVoo(i: number, patch: Partial<Voo>) {
    setForm((f) => ({ ...f, voos: f.voos.map((v, idx) => idx === i ? { ...v, ...patch } : v) }));
  }

  function handleCompanhiaSelect(i: number, companhia: Companhia) {
    setForm((f) => ({
      ...f,
      voos: f.voos.map((v, idx) => idx === i ? { ...v, companhia: companhia.nome } : v),
      forma_pagamento: getFormaPagamento(companhia.codigo) ?? "",
    }));
  }

  return (
    <>
      <Topbar
        title="Orçamentos"
        subtitle={`${filtered.length} orçamento${filtered.length !== 1 ? "s" : ""}`}
        actions={<Button onClick={openNew}><FilePlus className="h-4 w-4" />Novo Orçamento</Button>}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card>
          <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Lista de Orçamentos</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou número..." className="pl-10 sm:w-72" />
              </div>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44">
                <option value="">Todos status</option>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">Nenhum orçamento encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pax</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => {
                    const sb = STATUS_OPTIONS.find((s) => s.value === o.status) ?? STATUS_OPTIONS[0];
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.numero_orcamento ?? `#${o.id.slice(0, 6)}`}</TableCell>
                        <TableCell>{formatDate(o.data_orcamento)}</TableCell>
                        <TableCell className="font-medium">{o.cliente?.nome ?? "—"}</TableCell>
                        <TableCell className="text-xs text-[var(--text-secondary)]">{o.adultos}A · {o.criancas}C · {o.bebes}B</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(Number(o.valor_total))}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{o.vendedor?.nome ?? "—"}</TableCell>
                        <TableCell><Badge variant={sb.variant}>{sb.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Baixar PDF do orçamento"
                              onClick={() => gerarPdf(o)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Enviar orçamento pelo WhatsApp"
                              onClick={() => handleWhatsapp(o)}
                              className="text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                            >
                              <WhatsAppIcon className="h-4 w-4" />
                            </Button>
                            {podeGerarVenda(o) ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Gerar venda a partir deste orçamento"
                                disabled={convertingId === o.id}
                                onClick={() => handleGerarVenda(o)}
                                className="text-[var(--accent-600)] hover:bg-[var(--accent-50)]"
                              >
                                <ShoppingCart className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button variant="ghost" size="icon" onClick={() => openEdit(o)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(o)} title="Excluir" className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
            <DialogDescription>Preencha os dados do orçamento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5">
            {form.id ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Cliente</Label>
                    {form.cliente_id && (
                      <button
                        type="button"
                        onClick={() => openEditContato(form.cliente_id!)}
                        className="flex items-center gap-1 text-xs text-[var(--accent-600)] hover:underline"
                      >
                        <Pencil className="h-3 w-3" />Editar contato
                      </button>
                    )}
                  </div>
                  <div className="flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-muted)] px-3 py-2 text-sm min-h-[2.25rem]">
                    {form.cliente_nome || "—"}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Data do orçamento *</Label>
                  <Input type="date" value={form.data_orcamento} onChange={(e) => setForm({ ...form, data_orcamento: e.target.value })} required />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome do lead *</Label>
                    <Autocomplete
                      value={form.cliente_nome}
                      onValueChange={(text) => setForm((f) => ({ ...f, cliente_nome: text, cliente_id: null }))}
                      onSelect={(opt) => setForm((f) => ({ ...f, cliente_nome: opt.label, cliente_id: (opt.value as { id: string }).id }))}
                      options={clientes
                        .filter((c) => !form.cliente_nome.trim() || c.nome.toLowerCase().includes(form.cliente_nome.toLowerCase()))
                        .map((c) => ({ value: c, label: c.nome, description: c.telefone ?? undefined }))}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone (WhatsApp)</Label>
                    <Input
                      type="tel"
                      value={form.lead_telefone}
                      onChange={(e) => setForm((f) => ({ ...f, lead_telefone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 sm:max-w-[50%]">
                  <Label>Data do orçamento *</Label>
                  <Input type="date" value={form.data_orcamento} onChange={(e) => setForm({ ...form, data_orcamento: e.target.value })} required />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de viagem</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: "nacional" as const, label: "Nacional" },
                    { value: "internacional" as const, label: "Internacional" },
                  ] as const
                ).map((opt) => {
                  const active = form.tipo_viagem === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, tipo_viagem: opt.value }))}
                      className={[
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition",
                        active
                          ? "border-[var(--accent-600)] bg-[var(--accent-50)] text-[var(--accent-700)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-muted)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "grid h-4 w-4 place-items-center rounded-full border",
                          active ? "border-[var(--accent-600)]" : "border-[var(--border-subtle)]",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <span className={["h-2 w-2 rounded-full", active ? "bg-[var(--accent-600)]" : "bg-transparent"].join(" ")} />
                      </span>
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <fieldset className="space-y-3 rounded-md border border-[var(--border-subtle)] p-4">
              <legend className="px-2 text-sm font-semibold text-foreground">Passageiros</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Adultos (12+)</Label>
                  <Input type="number" min={1} value={form.adultos} onChange={(e) => setForm({ ...form, adultos: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Crianças (2-11)</Label>
                  <Input type="number" min={0} value={form.criancas} onChange={(e) => setForm({ ...form, criancas: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bebês (0-23m)</Label>
                  <Input type="number" min={0} value={form.bebes} onChange={(e) => setForm({ ...form, bebes: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Bagagem</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      { key: "bolsa" as const, label: "Bolsa/Mochila", Icon: BolsaMochilaIcon },
                      { key: "mao" as const, label: "Mala de mão", Icon: MalaMaoIcon },
                      { key: "grande" as const, label: "Mala grande", Icon: MalaGrandeIcon },
                    ] as const
                  ).map((item) => (
                    <div key={item.key} className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--bg-muted)] text-[var(--accent-700)]" aria-hidden="true">
                        <item.Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">{item.label}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">Qtd.</p>
                      </div>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={9}
                        value={form.bagagens[item.key]}
                        onChange={(e) => {
                          const nextBagagens = normalizeBagagens({ ...form.bagagens, [item.key]: Number(e.target.value) });
                          setForm((f) => ({ ...f, bagagens: nextBagagens, com_bagagem: temAlgumaBagagem(nextBagagens) }));
                        }}
                        className="w-20"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-md border border-[var(--border-subtle)] p-4">
              <legend className="px-2 text-sm font-semibold text-foreground">Voos</legend>
              {["ida", "volta"].map((tipo) => {
                const voosDoTipo = form.voos.map((v, i) => ({ v, i })).filter((x) => x.v.tipo === tipo);
                return (
                  <div key={tipo} className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">Voos de {tipo.toUpperCase()}</p>
                    {voosDoTipo.length === 0 && <p className="text-xs text-[var(--text-secondary)]">Nenhum voo adicionado.</p>}
                    {voosDoTipo.map(({ v, i }) => (
                      <div key={i} className="space-y-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-[var(--text-secondary)]">Voo #{i + 1}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeVoo(i)} className="text-[var(--danger-text)]">
                            <X className="h-3 w-3" /> Remover
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><Label>Origem</Label>
                            <Autocomplete value={v.origem} onValueChange={(t) => updateVoo(i, { origem: t })} onSelect={(opt) => updateVoo(i, { origem: `${(opt.value as Aeroporto).codigo} - ${(opt.value as Aeroporto).cidade}` })} options={searchAeroportos(v.origem, aeroportos).map((a) => ({ value: a, label: `${a.codigo} - ${a.cidade}`, description: `${a.nome}, ${a.pais}` }))} placeholder="Aeroporto de origem" />
                          </div>
                          <div><Label>Destino</Label>
                            <Autocomplete value={v.destino} onValueChange={(t) => updateVoo(i, { destino: t })} onSelect={(opt) => updateVoo(i, { destino: `${(opt.value as Aeroporto).codigo} - ${(opt.value as Aeroporto).cidade}` })} options={searchAeroportos(v.destino, aeroportos).map((a) => ({ value: a, label: `${a.codigo} - ${a.cidade}`, description: `${a.nome}, ${a.pais}` }))} placeholder="Aeroporto de destino" />
                          </div>
                          <div><Label>Data de Partida</Label><Input type="date" value={v.data_partida} onChange={(e) => updateVoo(i, { data_partida: e.target.value })} /></div>
                          <div><Label>Horário de Partida</Label><Input type="time" value={v.horario_saida} onChange={(e) => updateVoo(i, { horario_saida: e.target.value })} /></div>
                          <div><Label>Data de Chegada</Label><Input type="date" value={v.data_chegada} onChange={(e) => updateVoo(i, { data_chegada: e.target.value })} /></div>
                          <div><Label>Horário de Chegada</Label><Input type="time" value={v.horario_chegada} onChange={(e) => updateVoo(i, { horario_chegada: e.target.value })} /></div>
                          <div><Label>Companhia</Label>
                            <Autocomplete value={v.companhia} onValueChange={(t) => { updateVoo(i, { companhia: t }); if (!t.trim()) setForm((f) => ({ ...f, forma_pagamento: "" })); }} onSelect={(opt) => handleCompanhiaSelect(i, opt.value as Companhia)} options={searchCompanhias(v.companhia, companhias).map((c) => ({ value: c, label: c.nome, description: `${c.codigo} · ${c.pais}` }))} placeholder="LATAM, GOL, Azul..." />
                          </div>
                          <div><Label>Número do voo</Label><Input value={v.numero_voo} onChange={(e) => updateVoo(i, { numero_voo: e.target.value })} placeholder="LA1234" /></div>
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => addVoo(tipo as "ida" | "volta")}>
                      <Plus className="h-4 w-4" /> Adicionar voo de {tipo.toUpperCase()}
                    </Button>
                    {tipo === "ida" && <div className="h-px w-full bg-[var(--border-subtle)]" />}
                  </div>
                );
              })}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Valor total *</Label>
                <CurrencyInput value={form.valor_total} onValueChange={(v) => setForm((p) => ({ ...p, valor_total: v ?? 0 }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Formas de pagamento</Label>
              <Textarea rows={3} value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} placeholder="Selecione uma companhia aérea para preencher automaticamente." />
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : form.id ? "Atualizar" : "Cadastrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editContatoOpen} onOpenChange={(v) => { setEditContatoOpen(v); if (!v) setEditContatoForm(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar contato</DialogTitle>
            <DialogDescription>Adicione mais informações ao contato criado com o orçamento.</DialogDescription>
          </DialogHeader>
          {editContatoForm && (
            <form onSubmit={handleSaveContato} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome *</Label>
                  <Input value={editContatoForm.nome} onChange={(e) => setEditContatoForm((f) => f ? { ...f, nome: e.target.value } : f)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone (WhatsApp)</Label>
                  <Input type="tel" value={editContatoForm.telefone} onChange={(e) => setEditContatoForm((f) => f ? { ...f, telefone: e.target.value } : f)} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" value={editContatoForm.email} onChange={(e) => setEditContatoForm((f) => f ? { ...f, email: e.target.value } : f)} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF</Label>
                  <Input value={editContatoForm.cpf} onChange={(e) => setEditContatoForm((f) => f ? { ...f, cpf: e.target.value } : f)} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-1.5">
                  <Label>RG</Label>
                  <Input value={editContatoForm.rg} onChange={(e) => setEditContatoForm((f) => f ? { ...f, rg: e.target.value } : f)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={editContatoForm.data_nascimento} onChange={(e) => setEditContatoForm((f) => f ? { ...f, data_nascimento: e.target.value } : f)} />
                </div>
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input value={editContatoForm.cep} onChange={(e) => setEditContatoForm((f) => f ? { ...f, cep: e.target.value } : f)} placeholder="00000-000" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={editContatoForm.endereco} onChange={(e) => setEditContatoForm((f) => f ? { ...f, endereco: e.target.value } : f)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={editContatoForm.cidade} onChange={(e) => setEditContatoForm((f) => f ? { ...f, cidade: e.target.value } : f)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Input value={editContatoForm.estado} onChange={(e) => setEditContatoForm((f) => f ? { ...f, estado: e.target.value } : f)} placeholder="SP" maxLength={2} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={editContatoForm.observacoes} onChange={(e) => setEditContatoForm((f) => f ? { ...f, observacoes: e.target.value } : f)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editContatoForm.status} onChange={(e) => setEditContatoForm((f) => f ? { ...f, status: e.target.value } : f)}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setEditContatoOpen(false); setEditContatoForm(null); }} disabled={savingContato}>Cancelar</Button>
                <Button type="submit" disabled={savingContato}>{savingContato ? "Salvando..." : "Salvar contato"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
