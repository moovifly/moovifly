"use client";

import { Landmark, Loader2, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { MobileCardList } from "@/components/backoffice/mobile-card-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
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
import { formatPercent, getInitials } from "@/lib/format";
import { publicUrlForPath } from "@/lib/public-site-url";
import { ConfiguracoesContasBancarias } from "./configuracoes-contas-bancarias";

type Usuario = { id: string; nome: string; email: string; tipo: string; ativo: boolean; comissao_percentual: number | null };

type FormState = { id: string | null; nome: string; email: string; tipo: string; ativo: boolean; comissao_percentual: string };

type FormErrors = { nome?: string; email?: string; comissao?: string };

const emptyForm = (): FormState => ({ id: null, nome: "", email: "", tipo: "vendedor", ativo: true, comissao_percentual: "0" });

type NovoFluxo = "invite" | "link";

/** Valores do query param `tab` — contrato com o submenu da sidebar. */
const TAB_USUARIOS = "usuarios";
const TAB_CONTAS = "contas-bancarias";
const TAB_VALUES = [TAB_USUARIOS, TAB_CONTAS] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_BADGE_CLASS: Record<string, string> = {
  administrador: "bg-[var(--accent-glow)] text-[var(--accent-600)]",
  gerente: "bg-[var(--info-bg)] text-[var(--info-text)]",
  vendedor: "bg-[var(--bg-overlay)] text-[var(--text-secondary)]",
};

function formatComissao(value: number | string | null): string {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return "—";
  return formatPercent(num, Number.isInteger(num) ? 0 : 2);
}

export function ConfiguracoesClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [items, setItems] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [novoFluxo, setNovoFluxo] = useState<NovoFluxo>("invite");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [configTab, setConfigTab] = useState<string>(TAB_USUARIOS);
  const [roleFilter, setRoleFilter] = useState<string>("todos");

  // Deep-link: a sidebar navega com <a> (reload completo), então basta ler o param na montagem.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("tab");
    if (param && (TAB_VALUES as readonly string[]).includes(param)) setConfigTab(param);
  }, []);

  function handleTabChange(tab: string) {
    setConfigTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("usuarios").select("*").order("nome");
    if (error) toast.error("Erro ao carregar usuários", { description: error.message });
    setItems((data ?? []) as Usuario[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ativos = items.filter((u) => u.ativo).length;
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of items) counts[u.tipo] = (counts[u.tipo] ?? 0) + 1;
    return counts;
  }, [items]);
  const filtered = roleFilter === "todos" ? items : items.filter((u) => u.tipo === roleFilter);

  function openNew() {
    setForm(emptyForm());
    setErrors({});
    setNovoFluxo("invite");
    setOpen(true);
  }

  function openEdit(u: Usuario) {
    setForm({ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo, ativo: u.ativo, comissao_percentual: String(u.comissao_percentual ?? 0) });
    setErrors({});
    setOpen(true);
  }

  function validate(): { ok: boolean; comissao: number } {
    const next: FormErrors = {};
    if (form.nome.trim().length < 2) next.nome = "Informe o nome completo do usuário.";
    if (!form.id) {
      if (!form.email.trim()) next.email = "Informe o e-mail.";
      else if (!EMAIL_RE.test(form.email.trim())) next.email = "E-mail inválido. Confira o endereço digitado.";
    }
    const comissao = Number(form.comissao_percentual.replace(",", "."));
    if (form.comissao_percentual.trim() === "" || Number.isNaN(comissao)) {
      next.comissao = "Informe um percentual (use 0 se não houver comissão).";
    } else if (comissao < 0 || comissao > 100) {
      next.comissao = "O percentual deve estar entre 0 e 100.";
    }
    setErrors(next);
    return { ok: Object.keys(next).length === 0, comissao: Number.isNaN(comissao) ? 0 : comissao };
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const { ok, comissao } = validate();
    if (!ok) return;
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase
          .from("usuarios")
          .update({ nome: form.nome.trim(), tipo: form.tipo, ativo: form.ativo, comissao_percentual: comissao })
          .eq("id", form.id);
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
            comissao_percentual: comissao,
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
    if (u.ativo && profile?.id === u.id) {
      toast.error("Você não pode inativar a si mesmo.");
      return;
    }
    const ok = await showConfirm({
      title: u.ativo ? "Inativar usuário" : "Ativar usuário",
      message: u.ativo
        ? `Inativar "${u.nome}"? Ele perderá o acesso ao backoffice até ser reativado.`
        : `Ativar "${u.nome}"? Ele voltará a ter acesso ao backoffice.`,
      confirmText: u.ativo ? "Inativar" : "Ativar",
      destructive: u.ativo,
    });
    if (!ok) return;
    const { error } = await supabase.from("usuarios").update({ ativo: !u.ativo }).eq("id", u.id);
    if (error) {
      toast.error("Erro ao atualizar status", { description: formatSupabaseError(error) });
      return;
    }
    toast.success(u.ativo ? "Usuário inativado." : "Usuário ativado.");
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

  const filterOptions: Array<[string, string]> = [
    ["todos", "Todos"],
    ...Object.entries(ROLE_LABELS).filter(([k]) => (roleCounts[k] ?? 0) > 0),
  ];

  return (
    <>
      <Topbar title="Configurações" subtitle="Usuários, funções e contas bancárias da agência" />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <Tabs value={configTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value={TAB_USUARIOS}>
              <UsersRound className="mr-1.5 h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value={TAB_CONTAS}>
              <Landmark className="mr-1.5 h-4 w-4" />
              Contas Bancárias
            </TabsTrigger>
          </TabsList>

          <TabsContent value={TAB_USUARIOS} className="mt-6 space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle>Usuários do sistema</CardTitle>
                  <CardDescription>
                    {loading
                      ? "Carregando usuários..."
                      : `${items.length} ${items.length === 1 ? "usuário" : "usuários"} · ${ativos} com acesso ativo`}
                  </CardDescription>
                </div>
                <Button onClick={openNew} className="shrink-0">
                  <Plus className="h-4 w-4" />
                  Novo usuário
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {!loading && items.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por função">
                    {filterOptions.map(([value, label]) => {
                      const count = value === "todos" ? items.length : roleCounts[value] ?? 0;
                      const active = roleFilter === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRoleFilter(value)}
                          aria-pressed={active}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            active
                              ? "border-transparent bg-[var(--accent-600)] text-white"
                              : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-foreground"
                          }`}
                        >
                          {label}
                          <span className={active ? "opacity-80" : "text-[var(--text-muted)]"}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-overlay)]">
                      <UsersRound className="h-6 w-6 text-[var(--text-secondary)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Nenhum usuário cadastrado</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Convide a equipe da agência para acessar o backoffice.
                      </p>
                    </div>
                    <Button size="sm" onClick={openNew}>
                      <Plus className="h-4 w-4" />
                      Novo usuário
                    </Button>
                  </div>
                ) : (
                  <>
                    <MobileCardList
                      rows={filtered.map((u) => {
                        const isSelf = profile?.id === u.id;
                        return {
                          key: u.id,
                          title: (
                            <span className="flex items-center gap-1.5">
                              {u.nome}
                              {isSelf && (
                                <span className="rounded-full bg-[var(--bg-overlay)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                                  você
                                </span>
                              )}
                            </span>
                          ),
                          subtitle: u.email,
                          details: u.comissao_percentual != null ? [{ label: "Comissão", value: formatComissao(u.comissao_percentual) }] : undefined,
                          badge: (
                            <div className="flex flex-col items-end gap-1">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE_CLASS[u.tipo] ?? ROLE_BADGE_CLASS.vendedor}`}>
                                {ROLE_LABELS[u.tipo] ?? u.tipo}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleAtivo(u)}
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.ativo ? "bg-[var(--success-bg)] text-[var(--success-text)]" : "bg-[var(--danger-bg)] text-[var(--danger-text)]"}`}
                              >
                                {u.ativo ? "Ativo" : "Inativo"}
                              </button>
                            </div>
                          ),
                          actions: (
                            <>
                              <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => openEdit(u)} title="Editar" aria-label={`Editar ${u.nome}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                                onClick={() => excluirUsuario(u)}
                                title={isSelf ? "Você não pode excluir a si mesmo" : "Excluir usuário"}
                                aria-label={`Excluir ${u.nome}`}
                                disabled={isSelf}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ),
                        };
                      })}
                    />
                    <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-sm text-[var(--text-secondary)]">
                            Nenhum usuário com a função {ROLE_LABELS[roleFilter] ?? roleFilter}.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((u) => {
                          const isSelf = profile?.id === u.id;
                          return (
                            <TableRow key={u.id} className={!u.ativo ? "opacity-60" : undefined}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-9 w-9">
                                    <AvatarFallback>{getInitials(u.nome)}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                                      {u.nome}
                                      {isSelf && (
                                        <span className="rounded-full bg-[var(--bg-overlay)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                                          você
                                        </span>
                                      )}
                                    </p>
                                    <p className="truncate text-xs text-[var(--text-secondary)]">{u.email}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    ROLE_BADGE_CLASS[u.tipo] ?? ROLE_BADGE_CLASS.vendedor
                                  }`}
                                >
                                  {ROLE_LABELS[u.tipo] ?? u.tipo}
                                </span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {u.comissao_percentual != null ? formatComissao(u.comissao_percentual) : "—"}
                              </TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => toggleAtivo(u)}
                                  title={u.ativo ? "Clique para inativar" : "Clique para ativar"}
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 ${
                                    u.ativo
                                      ? "bg-[var(--success-bg)] text-[var(--success-text)]"
                                      : "bg-[var(--danger-bg)] text-[var(--danger-text)]"
                                  }`}
                                >
                                  {u.ativo ? "Ativo" : "Inativo"}
                                </button>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar" aria-label={`Editar ${u.nome}`}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-[var(--danger-text)] hover:text-[var(--danger-text)]"
                                  onClick={() => excluirUsuario(u)}
                                  title={isSelf ? "Você não pode excluir a si mesmo" : "Excluir usuário"}
                                  aria-label={`Excluir ${u.nome}`}
                                  disabled={isSelf}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value={TAB_CONTAS} className="mt-6">
            <ConfiguracoesContasBancarias />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar usuário" : novoFluxo === "link" ? "Vincular ao Auth existente" : "Convidar usuário"}
            </DialogTitle>
            <DialogDescription>
              {form.id
                ? "Atualize os dados, a função e a comissão do usuário."
                : novoFluxo === "invite"
                  ? "Um convite será enviado por e-mail; o usuário define a senha ao aceitar."
                  : "Use quando o usuário já existir em Supabase → Authentication → Users. Nenhum e-mail é enviado."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4" noValidate>
            {!form.id && (
              <div className="space-y-1.5">
                <Label htmlFor="usuario-modo">Modo de cadastro</Label>
                <Select
                  id="usuario-modo"
                  value={novoFluxo}
                  onChange={(e) => setNovoFluxo(e.target.value as NovoFluxo)}
                >
                  <option value="invite">Convite por e-mail</option>
                  <option value="link">Já existe no Auth — vincular só ao backoffice</option>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="usuario-nome">Nome *</Label>
              <Input
                id="usuario-nome"
                value={form.nome}
                onChange={(e) => { setForm((f) => ({ ...f, nome: e.target.value })); setErrors((er) => ({ ...er, nome: undefined })); }}
                placeholder="Ex: Maria Silva"
                aria-invalid={!!errors.nome}
                className={errors.nome ? "border-[var(--danger-text)]" : undefined}
              />
              {errors.nome && <p className="text-xs text-[var(--danger-text)]">{errors.nome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-email">E-mail *</Label>
              <Input
                id="usuario-email"
                type="email"
                value={form.email}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setErrors((er) => ({ ...er, email: undefined })); }}
                placeholder="nome@exemplo.com"
                disabled={!!form.id}
                aria-invalid={!!errors.email}
                className={errors.email ? "border-[var(--danger-text)]" : undefined}
              />
              {form.id ? (
                <p className="text-xs text-[var(--text-secondary)]">O e-mail é gerenciado pela autenticação e não pode ser alterado aqui.</p>
              ) : (
                errors.email && <p className="text-xs text-[var(--danger-text)]">{errors.email}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-funcao">Função</Label>
              <Select id="usuario-funcao" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-comissao">Comissão (%)</Label>
              <Input
                id="usuario-comissao"
                type="number"
                step="0.01"
                min="0"
                max="100"
                inputMode="decimal"
                value={form.comissao_percentual}
                onChange={(e) => { setForm((f) => ({ ...f, comissao_percentual: e.target.value })); setErrors((er) => ({ ...er, comissao: undefined })); }}
                placeholder="0"
                aria-invalid={!!errors.comissao}
                className={errors.comissao ? "border-[var(--danger-text)]" : undefined}
              />
              {errors.comissao ? (
                <p className="text-xs text-[var(--danger-text)]">{errors.comissao}</p>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">
                  Percentual aplicado sobre a base de comissão (RAV + DU) das vendas aéreas.
                </p>
              )}
            </div>
            <label
              className={`flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] p-3 ${
                form.id && profile?.id === form.id ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[var(--bg-hover)]"
              }`}
            >
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                disabled={!!form.id && profile?.id === form.id}
                className="mt-0.5 h-4 w-4 accent-[var(--accent-600)]"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Usuário ativo</span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {form.id && profile?.id === form.id
                    ? "Você não pode inativar o próprio acesso."
                    : "Com acesso liberado ao backoffice."}
                </span>
              </span>
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving
                  ? "Salvando..."
                  : form.id
                    ? "Salvar alterações"
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
