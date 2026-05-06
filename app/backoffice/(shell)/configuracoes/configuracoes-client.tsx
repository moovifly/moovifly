"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { showConfirm } from "@/components/confirm-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { ROLE_LABELS } from "@/lib/auth";
import { publicUrlForPath } from "@/lib/public-site-url";

type Usuario = { id: string; nome: string; email: string; tipo: string; ativo: boolean; comissao_percentual: number | null };

type FormState = { id: string | null; nome: string; email: string; tipo: string; ativo: boolean; comissao_percentual: string };

const emptyForm = (): FormState => ({ id: null, nome: "", email: "", tipo: "vendedor", ativo: true, comissao_percentual: "0" });

type NovoFluxo = "invite" | "link";

export function ConfiguracoesClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [items, setItems] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [novoFluxo, setNovoFluxo] = useState<NovoFluxo>("invite");
  const [form, setForm] = useState<FormState>(emptyForm());

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("usuarios").select("*").order("nome");
    if (error) toast.error("Erro ao carregar usuários", { description: error.message });
    setItems((data ?? []) as Usuario[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openNew() {
    setForm(emptyForm());
    setNovoFluxo("invite");
    setOpen(true);
  }

  function openEdit(u: Usuario) {
    setForm({ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo, ativo: u.ativo, comissao_percentual: String(u.comissao_percentual ?? 0) });
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) { toast.error("Preencha nome e email."); return; }
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("usuarios").update({ nome: form.nome, tipo: form.tipo, ativo: form.ativo, comissao_percentual: Number(form.comissao_percentual) }).eq("id", form.id);
        if (error) throw error;
        toast.success("Usuário atualizado!");
      } else {
        const path =
          novoFluxo === "link"
            ? "/api/backoffice/usuarios/link"
            : "/api/backoffice/usuarios/invite";
        const res = await fetch(publicUrlForPath(path), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            nome: form.nome.trim(),
            email: form.email.trim(),
            tipo: form.tipo,
            ativo: form.ativo,
            comissao_percentual: Number(form.comissao_percentual),
          }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Falha ao salvar usuário.");
        toast.success(
          novoFluxo === "link"
            ? "Usuário vinculado. Ele já pode entrar com o e-mail e senha do Auth."
            : "Convite enviado! O usuário receberá um e-mail para criar a senha.",
        );
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error("Erro ao salvar", { description: formatSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(u: Usuario) {
    const ok = await showConfirm({
      title: u.ativo ? "Inativar usuário" : "Ativar usuário",
      message: `${u.ativo ? "Inativar" : "Ativar"} o usuário "${u.nome}"?`,
      confirmText: u.ativo ? "Inativar" : "Ativar",
    });
    if (!ok) return;
    await supabase.from("usuarios").update({ ativo: !u.ativo }).eq("id", u.id);
    toast.success("Status do usuário atualizado.");
    load();
  }

  async function excluirUsuario(u: Usuario) {
    if (profile?.id === u.id) {
      toast.error("Você não pode excluir a si mesmo.");
      return;
    }
    const ok = await showConfirm({
      title: "Excluir usuário",
      message: `Remover "${u.nome}" (${u.email}) do backoffice e da autenticação? Orçamentos, vendas e clientes vinculados ficarão sem vendedor. Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(publicUrlForPath(`/api/backoffice/usuarios/${u.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao excluir.");
      toast.success("Usuário excluído.");
      await load();
    } catch (err) {
      toast.error("Erro ao excluir", { description: formatSupabaseError(err) });
    }
  }

  return (
    <>
      <Topbar title="Configurações" subtitle="Gestão de usuários do sistema" actions={<Button onClick={openNew}><Plus className="h-4 w-4" />Novo Usuário</Button>} />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Card>
          <CardHeader><CardTitle>Usuários do Sistema</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell className="text-[var(--text-secondary)]">{u.email}</TableCell>
                      <TableCell>{ROLE_LABELS[u.tipo] ?? u.tipo}</TableCell>
                      <TableCell>{u.comissao_percentual != null ? `${u.comissao_percentual}%` : "—"}</TableCell>
                      <TableCell>
                        <span className={`cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold ${u.ativo ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--danger-bg)] text-[var(--danger-text)]"}`} onClick={() => toggleAtivo(u)}>
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => excluirUsuario(u)}
                          title="Excluir usuário"
                          disabled={profile?.id === u.id}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar usuário" : novoFluxo === "link" ? "Vincular ao Auth existente" : "Convidar usuário"}
            </DialogTitle>
            <DialogDescription>
              {form.id
                ? "Gerencie os dados do usuário."
                : novoFluxo === "invite"
                  ? "Um convite será enviado por e-mail; o usuário define a senha ao aceitar."
                  : "Use quando o usuário já existir em Supabase → Authentication → Users. Nenhum e-mail é enviado."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {!form.id && (
              <div className="space-y-1.5">
                <Label>Modo</Label>
                <Select
                  value={novoFluxo}
                  onChange={(e) => setNovoFluxo(e.target.value as NovoFluxo)}
                >
                  <option value="invite">Convite por e-mail</option>
                  <option value="link">Já existe no Auth — vincular só ao backoffice</option>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required disabled={!!form.id} />
            </div>
            <div className="space-y-1.5">
              <Label>Função</Label>
              <Select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.comissao_percentual}
                onChange={(e) => setForm((f) => ({ ...f, comissao_percentual: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.ativo ? "true" : "false"} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.value === "true" }))}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Salvando..."
                  : form.id
                    ? "Atualizar"
                    : novoFluxo === "link"
                      ? "Vincular usuário"
                      : "Enviar convite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
