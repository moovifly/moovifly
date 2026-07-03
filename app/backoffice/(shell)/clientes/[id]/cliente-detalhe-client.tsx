"use client";

import { ArrowLeft, FileText, Pencil, ShoppingCart, Wallet } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { BackofficeLink } from "@/components/backoffice/backoffice-link";
import { EmptyState } from "@/components/backoffice/empty-state";
import { Topbar } from "@/components/backoffice/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { formatCpfCnpj, formatCurrency, formatDate, formatPhoneBR } from "@/lib/format";

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

type Orcamento = {
  id: string;
  numero_orcamento: string | null;
  data_orcamento: string;
  valor_total: number | string;
  status: string;
};

type Venda = {
  id: string;
  numero_venda: string;
  data_venda: string;
  origem: string | null;
  destino: string | null;
  valor_total: number | string;
  status: string;
};

const ORCAMENTO_STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "info" | "destructive" }> = {
  aberto: { label: "Aberto", variant: "default" },
  enviado: { label: "Enviado", variant: "info" },
  aprovado: { label: "Aprovado", variant: "success" },
  recusado: { label: "Recusado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "default" },
};

const VENDA_STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "info" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "warning" },
  confirmada: { label: "Confirmada", variant: "success" },
  concluida: { label: "Concluída", variant: "default" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

function emptyForm(cliente?: Cliente): FormState {
  return {
    id: cliente?.id ?? null,
    nome: cliente?.nome ?? "",
    email: cliente?.email ?? "",
    telefone: cliente?.telefone ?? "",
    cpf: cliente?.cpf ?? "",
    rg: cliente?.rg ?? "",
    data_nascimento: cliente?.data_nascimento ?? "",
    endereco: cliente?.endereco ?? "",
    cidade: cliente?.cidade ?? "",
    estado: cliente?.estado ?? "",
    cep: cliente?.cep ?? "",
    observacoes: cliente?.observacoes ?? "",
    status: cliente?.status ?? "ativo",
    vendedor_id: cliente?.vendedor_id ?? null,
  };
}

export function ClienteDetalheClient() {
  const params = useParams();
  const id = params.id as string;
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  async function load() {
    setLoading(true);
    try {
      const [clienteRes, orcamentosRes, vendasRes] = await Promise.all([
        supabase.from("clientes").select("*").eq("id", id).single(),
        supabase
          .from("orcamentos")
          .select("id, numero_orcamento, data_orcamento, valor_total, status")
          .eq("cliente_id", id)
          .order("data_orcamento", { ascending: false }),
        supabase
          .from("vendas")
          .select("id, numero_venda, data_venda, origem, destino, valor_total, status")
          .eq("cliente_id", id)
          .order("data_venda", { ascending: false }),
      ]);

      if (clienteRes.error) throw clienteRes.error;
      if (orcamentosRes.error) throw orcamentosRes.error;
      if (vendasRes.error) throw vendasRes.error;

      setCliente(clienteRes.data as Cliente);
      setOrcamentos((orcamentosRes.data ?? []) as Orcamento[]);
      setVendas((vendasRes.data ?? []) as Venda[]);
    } catch (err) {
      toast.error("Erro ao carregar dados do cliente", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openEdit() {
    if (!cliente) return;
    setForm(emptyForm(cliente));
    setEditOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clientes")
        .update({
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
          vendedor_id: form.vendedor_id,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Cliente atualizado!");
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error("Erro ao salvar", { description: formatSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  }

  const f =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const totalGasto = useMemo(
    () => vendas.filter((v) => v.status !== "cancelada").reduce((acc, v) => acc + Number(v.valor_total), 0),
    [vendas],
  );

  const vendasValidas = useMemo(() => vendas.filter((v) => v.status !== "cancelada"), [vendas]);

  if (loading) {
    return (
      <>
        <Topbar title="Carregando..." />
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </>
    );
  }

  if (!cliente) {
    return (
      <>
        <Topbar title="Cliente não encontrado" />
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
          <p className="text-sm text-[var(--text-secondary)]">O cliente solicitado não foi encontrado.</p>
          <BackofficeLink href="/backoffice/clientes/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Clientes
            </Button>
          </BackofficeLink>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title={cliente.nome}
        subtitle={`Membro desde ${formatDate(cliente.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <BackofficeLink href="/backoffice/clientes/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Clientes
              </Button>
            </BackofficeLink>
            <Button size="sm" onClick={openEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Editar
            </Button>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        {/* Resumo */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-[var(--text-secondary)]">Orçamentos</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-2xl font-bold tracking-tight">{orcamentos.length}</span>
              <FileText className="mb-0.5 h-5 w-5 text-[var(--text-muted)]" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-[var(--text-secondary)]">Vendas</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-2xl font-bold tracking-tight">{vendasValidas.length}</span>
              <ShoppingCart className="mb-0.5 h-5 w-5 text-[var(--text-muted)]" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-medium text-[var(--text-secondary)]">Total gasto</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-2xl font-bold tracking-tight">{formatCurrency(totalGasto)}</span>
              <Wallet className="mb-0.5 h-5 w-5 text-[var(--text-muted)]" />
            </CardContent>
          </Card>
        </div>

        {/* Dados do cliente */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dados do cliente</CardTitle>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  cliente.status === "ativo"
                    ? "bg-[var(--success-bg)] text-[var(--success-text)]"
                    : "bg-[var(--danger-bg)] text-[var(--danger-text)]"
                }`}
              >
                {cliente.status}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  { label: "Email", value: cliente.email },
                  { label: "Telefone", value: formatPhoneBR(cliente.telefone) || null },
                  { label: "CPF", value: formatCpfCnpj(cliente.cpf) || null },
                  { label: "RG", value: cliente.rg },
                  {
                    label: "Nascimento",
                    value: formatDate(cliente.data_nascimento) !== "-" ? formatDate(cliente.data_nascimento) : null,
                  },
                  { label: "CEP", value: cliente.cep },
                  { label: "Endereço", value: cliente.endereco },
                  { label: "Cidade", value: cliente.cidade },
                  { label: "Estado", value: cliente.estado },
                ] as { label: string; value: string | null }[]
              ).map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-[var(--text-secondary)]">{label}</dt>
                  <dd className="mt-0.5 text-sm">{value ?? <span className="text-[var(--text-secondary)]">—</span>}</dd>
                </div>
              ))}
              {cliente.observacoes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-medium text-[var(--text-secondary)]">Observações</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm">{cliente.observacoes}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Orçamentos */}
        <Card>
          <CardHeader>
            <CardTitle>Orçamentos ({orcamentos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {orcamentos.length === 0 ? (
              <EmptyState icon={FileText} title="Nenhum orçamento registrado" className="py-8" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orcamentos.map((o) => {
                    const st = ORCAMENTO_STATUS[o.status] ?? { label: o.status, variant: "default" as const };
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.numero_orcamento ?? "—"}</TableCell>
                        <TableCell>{formatDate(o.data_orcamento)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(o.valor_total)}</TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Vendas */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas ({vendas.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {vendas.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="Nenhuma venda registrada" className="py-8" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Rota</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendas.map((v) => {
                    const st = VENDA_STATUS[v.status] ?? { label: v.status, variant: "default" as const };
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                        <TableCell>{formatDate(v.data_venda)}</TableCell>
                        <TableCell className="text-[var(--text-secondary)]">
                          {v.origem && v.destino ? `${v.origem} → ${v.destino}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(v.valor_total)}</TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
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

      {/* Dialog de edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Atualize os dados do cliente.</DialogDescription>
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
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Atualizar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
