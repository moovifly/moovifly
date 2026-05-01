"use client";

import { CreditCard, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Autocomplete } from "@/components/autocomplete";
import { showConfirm } from "@/components/confirm-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";

type Venda = {
  id: string;
  numero_venda: string;
  cliente_id: string | null;
  vendedor_id: string | null;
  tipo: string | null;
  origem: string | null;
  destino: string | null;
  data_ida: string | null;
  data_volta: string | null;
  data_venda: string;
  valor_total: number | string;
  taxa_rav: number | string;
  taxa_du: number | string;
  comissao_percentual: number | string;
  status: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  cliente?: { nome: string } | null;
  vendedor?: { nome: string } | null;
};

type Cliente = { id: string; nome: string };

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", variant: "warning" as const },
  { value: "confirmada", label: "Confirmada", variant: "success" as const },
  { value: "concluida", label: "Concluída", variant: "default" as const },
  { value: "cancelada", label: "Cancelada", variant: "destructive" as const },
];

const TIPO_OPTIONS = ["passagem", "pacote", "hospedagem", "corporativo", "lua-de-mel", "grupo", "outros"];

type FormState = {
  id: string | null;
  cliente_id: string | null;
  cliente_nome: string;
  tipo: string;
  origem: string;
  destino: string;
  data_ida: string;
  data_volta: string;
  data_venda: string;
  valor_total: string;
  taxa_rav: string;
  taxa_du: string;
  comissao_percentual: string;
  status: string;
  forma_pagamento: string;
  observacoes: string;
};

const emptyForm = (): FormState => ({
  id: null,
  cliente_id: null,
  cliente_nome: "",
  tipo: "passagem",
  origem: "",
  destino: "",
  data_ida: "",
  data_volta: "",
  data_venda: new Date().toISOString().slice(0, 10),
  valor_total: "",
  taxa_rav: "0",
  taxa_du: "0",
  comissao_percentual: "0",
  status: "pendente",
  forma_pagamento: "",
  observacoes: "",
});

export function VendasClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [items, setItems] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  async function load() {
    setLoading(true);
    try {
      let q = supabase.from("vendas").select("*, clientes(nome), usuarios(nome)").order("created_at", { ascending: false });
      if (profile?.tipo === "vendedor") q = q.eq("vendedor_id", profile.id);
      const { data, error } = await q;
      if (error) throw error;
      setItems((data ?? []) as unknown as Venda[]);

      const { data: cliData } = await supabase.from("clientes").select("id, nome").eq("status", "ativo").order("nome");
      setClientes((cliData ?? []) as Cliente[]);
    } catch (err) {
      toast.error("Erro ao carregar vendas", { description: String(err) });
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
    return items.filter((v) => {
      const cli = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
      const matchesTerm = !term || (cli?.nome ?? "").toLowerCase().includes(term) || (v.numero_venda ?? "").toLowerCase().includes(term) || (v.destino ?? "").toLowerCase().includes(term);
      const matchesStatus = !statusFilter || v.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [items, search, statusFilter]);

  function openNew() { setForm(emptyForm()); setOpen(true); }

  function openEdit(v: Venda) {
    const cli = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
    setForm({
      id: v.id,
      cliente_id: v.cliente_id,
      cliente_nome: cli?.nome ?? "",
      tipo: v.tipo ?? "passagem",
      origem: v.origem ?? "",
      destino: v.destino ?? "",
      data_ida: v.data_ida ?? "",
      data_volta: v.data_volta ?? "",
      data_venda: v.data_venda ?? new Date().toISOString().slice(0, 10),
      valor_total: String(v.valor_total ?? ""),
      taxa_rav: String(v.taxa_rav ?? "0"),
      taxa_du: String(v.taxa_du ?? "0"),
      comissao_percentual: String(v.comissao_percentual ?? "0"),
      status: v.status,
      forma_pagamento: v.forma_pagamento ?? "",
      observacoes: v.observacoes ?? "",
    });
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { toast.error("Selecione um cliente."); return; }
    if (!form.valor_total || Number(form.valor_total) <= 0) { toast.error("Informe um valor total válido."); return; }
    setSaving(true);
    try {
      const payload = {
        cliente_id: form.cliente_id,
        vendedor_id: profile?.id ?? null,
        tipo: form.tipo || null,
        origem: form.origem || null,
        destino: form.destino || null,
        data_ida: form.data_ida || null,
        data_volta: form.data_volta || null,
        data_venda: form.data_venda,
        valor_total: Number(form.valor_total),
        taxa_rav: Number(form.taxa_rav),
        taxa_du: Number(form.taxa_du),
        comissao_percentual: Number(form.comissao_percentual),
        status: form.status,
        forma_pagamento: form.forma_pagamento || null,
        observacoes: form.observacoes || null,
      };
      if (form.id) {
        const { error } = await supabase.from("vendas").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Venda atualizada!");
      } else {
        const { error } = await supabase.from("vendas").insert([payload]);
        if (error) throw error;
        toast.success("Venda cadastrada!");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error("Erro ao salvar", { description: String(err) });
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
      toast.error("Erro ao excluir", { description: String(err) });
    }
  }

  const f = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <>
      <Topbar
        title="Vendas"
        subtitle={`${filtered.length} venda${filtered.length !== 1 ? "s" : ""}`}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" />Nova Venda</Button>}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card>
          <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Lista de Vendas</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, número..." className="pl-10 sm:w-72" />
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
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">Nenhuma venda encontrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => {
                    const cli = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
                    const sb = STATUS_OPTIONS.find((s) => s.value === v.status) ?? STATUS_OPTIONS[0];
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                        <TableCell>{formatDate(v.data_venda)}</TableCell>
                        <TableCell className="font-medium">{cli?.nome ?? "—"}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">{v.destino ?? "—"}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(Number(v.valor_total))}</TableCell>
                        <TableCell><Badge variant={sb.variant}>{sb.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/backoffice/checkout/?id=${v.id}`}>
                              <Button variant="ghost" size="icon" title="Checkout"><CreditCard className="h-4 w-4" /></Button>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(v)} className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"><Trash2 className="h-4 w-4" /></Button>
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar venda" : "Nova venda"}</DialogTitle>
            <DialogDescription>Preencha os dados da venda.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Cliente *</Label>
                <Autocomplete
                  value={form.cliente_nome}
                  onValueChange={(text) => setForm((f) => ({ ...f, cliente_nome: text, cliente_id: null }))}
                  onSelect={(opt) => setForm((f) => ({ ...f, cliente_nome: opt.label, cliente_id: (opt.value as Cliente).id }))}
                  options={clientes.filter((c) => c.nome.toLowerCase().includes(form.cliente_nome.toLowerCase())).map((c) => ({ value: c, label: c.nome }))}
                  placeholder="Digite o nome do cliente..."
                />
              </div>
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
                <Input value={form.origem} onChange={f("origem")} placeholder="GRU - Guarulhos" />
              </div>
              <div className="space-y-1.5">
                <Label>Destino</Label>
                <Input value={form.destino} onChange={f("destino")} placeholder="GIG - Rio de Janeiro" />
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
                <Input type="number" step="0.01" min="0" value={form.valor_total} onChange={f("valor_total")} required />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa RAV (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.taxa_rav} onChange={f("taxa_rav")} />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa DU (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.taxa_du} onChange={f("taxa_du")} />
              </div>
              <div className="space-y-1.5">
                <Label>Comissão (%)</Label>
                <Input type="number" step="0.01" min="0" max="100" value={form.comissao_percentual} onChange={f("comissao_percentual")} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onChange={f("status")}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Forma de pagamento</Label>
                <Input value={form.forma_pagamento} onChange={f("forma_pagamento")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={form.observacoes} onChange={f("observacoes")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : form.id ? "Atualizar" : "Cadastrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
