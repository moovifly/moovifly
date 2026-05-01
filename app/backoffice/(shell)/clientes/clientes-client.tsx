"use client";

import { Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showConfirm } from "@/components/confirm-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatDate, formatPhoneBR, formatCpfCnpj } from "@/lib/format";

type Cliente = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  observacoes: string | null;
  status: string;
  vendedor_id: string | null;
  created_at: string;
};

type FormState = Omit<Cliente, "id" | "created_at"> & { id: string | null };

const emptyForm = (): FormState => ({
  id: null,
  nome: "",
  email: "",
  telefone: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  observacoes: "",
  status: "ativo",
  vendedor_id: null,
});

export function ClientesClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [items, setItems] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  async function load() {
    setLoading(true);
    try {
      let q = supabase.from("clientes").select("*").order("nome");
      if (profile?.tipo === "vendedor") q = q.eq("vendedor_id", profile.id);
      const { data, error } = await q;
      if (error) throw error;
      setItems((data ?? []) as Cliente[]);
    } catch (err) {
      toast.error("Erro ao carregar clientes", { description: String(err) });
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
    return items.filter((c) => {
      const matchesTerm = !term || c.nome.toLowerCase().includes(term) || (c.email ?? "").toLowerCase().includes(term);
      const matchesStatus = !statusFilter || c.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [items, search, statusFilter]);

  function openNew() {
    setForm({ ...emptyForm(), vendedor_id: profile?.id ?? null });
    setOpen(true);
  }

  function openEdit(c: Cliente) {
    setForm({
      id: c.id,
      nome: c.nome,
      email: c.email ?? "",
      telefone: c.telefone ?? "",
      cpf: c.cpf ?? "",
      rg: c.rg ?? "",
      data_nascimento: c.data_nascimento ?? "",
      endereco: c.endereco ?? "",
      cidade: c.cidade ?? "",
      estado: c.estado ?? "",
      cep: c.cep ?? "",
      observacoes: c.observacoes ?? "",
      status: c.status,
      vendedor_id: c.vendedor_id,
    });
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        email: form.email || null,
        telefone: form.telefone || null,
        cpf: form.cpf || null,
        rg: form.rg || null,
        data_nascimento: form.data_nascimento || null,
        endereco: form.endereco || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
        cep: form.cep || null,
        observacoes: form.observacoes || null,
        status: form.status,
        vendedor_id: form.vendedor_id ?? profile?.id ?? null,
      };

      if (form.id) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Cliente atualizado!");
      } else {
        const { error } = await supabase.from("clientes").insert([payload]);
        if (error) throw error;
        toast.success("Cliente cadastrado!");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error("Erro ao salvar", { description: String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Cliente) {
    const ok = await showConfirm({
      title: "Excluir cliente",
      message: `Excluir o cliente "${c.nome}"? Esta ação não pode ser desfeita.`,
      destructive: true,
      confirmText: "Excluir",
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", c.id);
      if (error) throw error;
      toast.success("Cliente excluído.");
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
        title="Clientes"
        subtitle={`${filtered.length} cliente${filtered.length !== 1 ? "s" : ""}`}
        actions={
          <Button onClick={openNew}>
            <UserPlus className="h-4 w-4" />
            Novo Cliente
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card>
          <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Lista de Clientes</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nome ou email..."
                  className="pl-10 sm:w-64"
                />
              </div>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-36">
                <option value="">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-secondary)]">Nenhum cliente encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{c.email ?? "—"}</TableCell>
                      <TableCell>{formatPhoneBR(c.telefone) || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCpfCnpj(c.cpf) || "—"}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{formatDate(c.created_at)}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "ativo" ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--danger-bg)] text-[var(--danger-text)]"}`}>
                          {c.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} className="text-[var(--danger-text)] hover:bg-[var(--danger-bg)]">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>Preencha os dados do cliente.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input id="nome" value={form.nome} onChange={f("nome")} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email ?? ""} onChange={f("email")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={form.telefone ?? ""} onChange={f("telefone")} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" value={form.cpf ?? ""} onChange={f("cpf")} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rg">RG</Label>
                <Input id="rg" value={form.rg ?? ""} onChange={f("rg")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data_nascimento">Data de nascimento</Label>
                <Input id="data_nascimento" type="date" value={form.data_nascimento ?? ""} onChange={f("data_nascimento")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" value={form.cep ?? ""} onChange={f("cep")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={form.endereco ?? ""} onChange={f("endereco")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" value={form.cidade ?? ""} onChange={f("cidade")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" value={form.estado ?? ""} onChange={f("estado")} maxLength={2} placeholder="SP" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onChange={f("status")}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" rows={3} value={form.observacoes ?? ""} onChange={f("observacoes")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : form.id ? "Atualizar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
