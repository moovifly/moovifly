"use client";

import { Pencil, Plus } from "lucide-react";
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
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { ROLE_LABELS } from "@/lib/auth";
import { publicUrlForPath } from "@/lib/public-site-url";

type Usuario = { id: string; nome: string; email: string; tipo: string; ativo: boolean };

type FormState = { id: string | null; nome: string; email: string; tipo: string; ativo: boolean };

const emptyForm = (): FormState => ({ id: null, nome: "", email: "", tipo: "vendedor", ativo: true });

export function ConfiguracoesClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [items, setItems] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("usuarios").select("*").order("nome");
    if (error) toast.error("Erro ao carregar usuários", { description: error.message });
    setItems((data ?? []) as Usuario[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openNew() { setForm(emptyForm()); setOpen(true); }

  function openEdit(u: Usuario) {
    setForm({ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo, ativo: u.ativo });
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim()) { toast.error("Preencha nome e email."); return; }
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("usuarios").update({ nome: form.nome, tipo: form.tipo, ativo: form.ativo }).eq("id", form.id);
        if (error) throw error;
        toast.success("Usuário atualizado!");
      } else {
        const res = await fetch(publicUrlForPath("/api/backoffice/usuarios/invite"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            nome: form.nome.trim(),
            email: form.email.trim(),
            tipo: form.tipo,
            ativo: form.ativo,
          }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || "Falha ao enviar convite.");
        toast.success("Convite enviado! O usuário receberá um e-mail para criar a senha.");
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
    const ok = await showConfirm({ title: u.ativo ? "Inativar usuário" : "Ativar usuário", message: `${u.ativo ? "Inativar" : "Ativar"} o usuário "${u.nome}"?`, confirmText: u.ativo ? "Inativar" : "Ativar" });
    if (!ok) return;
    await supabase.from("usuarios").update({ ativo: !u.ativo }).eq("id", u.id);
    toast.success("Status do usuário atualizado.");
    load();
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
                      <TableCell>
                        <span className={`cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold ${u.ativo ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--danger-bg)] text-[var(--danger-text)]"}`} onClick={() => toggleAtivo(u)}>
                          {u.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
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
            <DialogTitle>{form.id ? "Editar usuário" : "Convidar usuário"}</DialogTitle>
            <DialogDescription>
              {form.id ? "Gerencie os dados do usuário." : "Um convite será enviado por e-mail; o usuário define a senha ao aceitar."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
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
              <Label>Status</Label>
              <Select value={form.ativo ? "true" : "false"} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.value === "true" }))}>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : form.id ? "Atualizar" : "Enviar convite"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
