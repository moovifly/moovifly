"use client";

import { ChevronLeft, ChevronRight, Pencil, Search, Trash2, UserPlus } from "lucide-react";
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
import { BackofficeLink } from "@/components/backoffice/backoffice-link";
import { EmptyState } from "@/components/backoffice/empty-state";
import { showConfirm } from "@/components/confirm-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
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

const PAGE_SIZE = 30;

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
  const [page, setPage] = useState(1);
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
      toast.error("Erro ao carregar clientes", { description: formatSupabaseError(err) });
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

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

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
      toast.error(form.id ? "Erro ao atualizar cliente" : "Erro ao cadastrar cliente", {
        description: formatSupabaseError(err),
      });
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
      toast.error("Erro ao excluir", { description: formatSupabaseError(err) });
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
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
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
              <EmptyState
                icon={UserPlus}
                title="Nenhum cliente encontrado"
                description="Ajuste a busca ou cadastre um novo cliente."
              />
            ) : (
              <>
              {/* Lista mobile: cards com dados-chave e as mesmas ações da tabela */}
              <div className="space-y-3 md:hidden">
                {paginated.map((c) => (
                  <div key={c.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <BackofficeLink
                          href={`/backoffice/clientes/${c.id}/`}
                          className="block truncate text-sm font-medium text-foreground hover:underline"
                        >
                          {c.nome}
                        </BackofficeLink>
                        <p className="truncate text-xs text-[var(--text-secondary)]">{c.email ?? "—"}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "ativo" ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--danger-bg)] text-[var(--danger-text)]"}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                      <span>{formatPhoneBR(c.telefone) || "—"}</span>
                      {formatCpfCnpj(c.cpf) && <span className="font-mono">{formatCpfCnpj(c.cpf)}</span>}
                      <span>Desde {formatDate(c.created_at)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1 border-t border-[var(--border-subtle)] pt-2">
                      <Button variant="ghost" size="icon" className="h-11 w-11" title="Editar" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(c)} className="h-11 w-11 text-[var(--danger-text)] hover:bg-[var(--danger-bg)]">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Tabela (md+) */}
              <div className="hidden md:block">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="hidden lg:table-cell">CPF</TableHead>
                    <TableHead className="hidden lg:table-cell">Cadastro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <BackofficeLink
                          href={`/backoffice/clientes/${c.id}/`}
                          className="hover:underline"
                        >
                          {c.nome}
                        </BackofficeLink>
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{c.email ?? "—"}</TableCell>
                      <TableCell>{formatPhoneBR(c.telefone) || "—"}</TableCell>
                      <TableCell className="hidden font-mono text-xs lg:table-cell">{formatCpfCnpj(c.cpf) || "—"}</TableCell>
                      <TableCell className="hidden text-[var(--text-secondary)] lg:table-cell">{formatDate(c.created_at)}</TableCell>
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
              </div>
              </>
            )}
          </CardContent>
          {!loading && filtered.length > 0 && totalPages > 1 && (
            <div className="flex flex-col items-center gap-3 border-t border-[var(--border-default)] px-4 py-4 sm:flex-row sm:justify-between sm:gap-4 sm:px-6">
              <p className="text-sm text-[var(--text-secondary)]">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
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
