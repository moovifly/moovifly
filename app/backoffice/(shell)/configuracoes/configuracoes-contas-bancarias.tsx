"use client";

import { Check, Landmark, Loader2, Pencil, Plus, Star } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { showConfirm } from "@/components/confirm-modal";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { formatCurrency, formatDate } from "@/lib/format";

type ContaBancaria = {
  id: string;
  nome: string;
  banco: string | null;
  tipo_conta: string;
  agencia: string | null;
  numero_conta: string | null;
  chave_pix: string | null;
  saldo_inicial: number;
  data_saldo_inicial: string;
  cor: string;
  principal: boolean;
  ativa: boolean;
};

type FormState = {
  id: string | null;
  nome: string;
  banco: string;
  tipo_conta: string;
  agencia: string;
  numero_conta: string;
  chave_pix: string;
  saldo_inicial: number;
  data_saldo_inicial: string;
  cor: string;
  principal: boolean;
  ativa: boolean;
};

type FormErrors = { nome?: string; data?: string };

const CORES = ["#6B7280", "#2563EB", "#16A34A", "#DC2626", "#9333EA", "#EA580C", "#0891B2"];

const TIPO_LABEL: Record<string, string> = {
  corrente: "Conta Corrente",
  poupanca: "Poupança",
  caixa: "Caixa Físico",
  digital: "Carteira Digital",
};

const emptyForm = (): FormState => ({
  id: null,
  nome: "",
  banco: "",
  tipo_conta: "corrente",
  agencia: "",
  numero_conta: "",
  chave_pix: "",
  saldo_inicial: 0,
  data_saldo_inicial: new Date().toISOString().slice(0, 10),
  cor: CORES[0],
  principal: false,
  ativa: true,
});

function dadosBancarios(c: ContaBancaria): string | null {
  const parts: string[] = [];
  if (c.agencia) parts.push(`Ag. ${c.agencia}`);
  if (c.numero_conta) parts.push(`Conta ${c.numero_conta}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function ConfiguracoesContasBancarias() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [items, setItems] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contas_bancarias")
      .select("*")
      .order("principal", { ascending: false })
      .order("nome");
    if (error) toast.error("Erro ao carregar contas", { description: error.message });
    setItems((data ?? []) as ContaBancaria[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ativas = items.filter((c) => c.ativa);
  const saldoTotal = ativas.reduce((sum, c) => sum + Number(c.saldo_inicial || 0), 0);

  function openNew() {
    setForm(emptyForm());
    setErrors({});
    setOpen(true);
  }

  function openEdit(c: ContaBancaria) {
    setForm({
      id: c.id,
      nome: c.nome,
      banco: c.banco ?? "",
      tipo_conta: c.tipo_conta,
      agencia: c.agencia ?? "",
      numero_conta: c.numero_conta ?? "",
      chave_pix: c.chave_pix ?? "",
      saldo_inicial: Number(c.saldo_inicial),
      data_saldo_inicial: c.data_saldo_inicial,
      cor: c.cor,
      principal: c.principal,
      ativa: c.ativa,
    });
    setErrors({});
    setOpen(true);
  }

  async function clearOtherPrincipal(exceptId?: string) {
    let q = supabase.from("contas_bancarias").update({ principal: false }).eq("principal", true);
    if (exceptId) q = q.neq("id", exceptId);
    const { error } = await q;
    if (error) throw error;
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (form.nome.trim().length < 2) next.nome = "Informe um nome para identificar a conta.";
    if (!form.data_saldo_inicial) next.data = "Informe a data de referência do saldo inicial.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        banco: form.banco.trim() || null,
        tipo_conta: form.tipo_conta,
        agencia: form.agencia.trim() || null,
        numero_conta: form.numero_conta.trim() || null,
        chave_pix: form.chave_pix.trim() || null,
        saldo_inicial: form.saldo_inicial,
        data_saldo_inicial: form.data_saldo_inicial,
        cor: form.cor,
        principal: form.principal,
        ativa: form.ativa,
      };

      if (form.principal) {
        await clearOtherPrincipal(form.id ?? undefined);
      }

      if (form.id) {
        const { error } = await supabase.from("contas_bancarias").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Conta atualizada!");
      } else {
        const { error } = await supabase.from("contas_bancarias").insert(payload);
        if (error) throw error;
        toast.success("Conta criada!");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error("Erro ao salvar", { description: formatSupabaseError(err) });
    } finally {
      setSaving(false);
    }
  }

  async function togglePrincipal(c: ContaBancaria) {
    if (c.principal) return;
    const ok = await showConfirm({
      title: "Definir conta principal",
      message: `Usar "${c.nome}" como conta padrão do fluxo de caixa? A conta principal atual deixará de ser o padrão.`,
      confirmText: "Definir principal",
    });
    if (!ok) return;
    try {
      await clearOtherPrincipal(c.id);
      const { error } = await supabase.from("contas_bancarias").update({ principal: true }).eq("id", c.id);
      if (error) throw error;
      toast.success(`"${c.nome}" definida como conta principal.`);
      load();
    } catch (err) {
      toast.error("Erro ao definir principal", { description: formatSupabaseError(err) });
    }
  }

  async function toggleAtiva(c: ContaBancaria) {
    const ok = await showConfirm({
      title: c.ativa ? "Inativar conta" : "Ativar conta",
      message: c.ativa
        ? `Inativar "${c.nome}"? Ela deixa de aparecer nos lançamentos do fluxo de caixa, mas o histórico é preservado.`
        : `Ativar "${c.nome}"? Ela voltará a ficar disponível nos lançamentos.`,
      confirmText: c.ativa ? "Inativar" : "Ativar",
      destructive: c.ativa,
    });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("contas_bancarias")
        .update({ ativa: !c.ativa, principal: c.ativa && c.principal ? false : c.principal })
        .eq("id", c.id);
      if (error) throw error;
      toast.success(c.ativa ? "Conta inativada." : "Conta ativada.");
      load();
    } catch (err) {
      toast.error("Erro ao atualizar", { description: formatSupabaseError(err) });
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Contas bancárias e caixa</CardTitle>
            <CardDescription>
              {loading
                ? "Carregando contas..."
                : items.length === 0
                  ? "Contas usadas nos lançamentos do fluxo de caixa."
                  : `${items.length} ${items.length === 1 ? "conta" : "contas"} · saldo inicial das ativas: ${formatCurrency(saldoTotal)}`}
            </CardDescription>
          </div>
          <Button onClick={openNew} className="shrink-0">
            <Plus className="h-4 w-4" />
            Nova conta
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-overlay)]">
                <Landmark className="h-6 w-6 text-[var(--text-secondary)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Nenhuma conta cadastrada</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Adicione a conta principal da agência para usá-la no fluxo de caixa.
                </p>
              </div>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4" />
                Nova conta
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Dados bancários</TableHead>
                  <TableHead className="text-right">Saldo inicial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id} className={!c.ativa ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                          style={{ backgroundColor: c.cor }}
                          aria-hidden="true"
                        />
                        <span className="font-medium text-foreground">{c.nome}</span>
                        {c.principal && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-glow)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-600)]">
                            <Star className="h-2.5 w-2.5 fill-current" />
                            Principal
                          </span>
                        )}
                      </div>
                      {c.banco && <p className="mt-0.5 pl-5 text-xs text-[var(--text-secondary)]">{c.banco}</p>}
                    </TableCell>
                    <TableCell>{TIPO_LABEL[c.tipo_conta] ?? c.tipo_conta}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {dadosBancarios(c) ? (
                        <span className="text-[var(--text-secondary)]">{dadosBancarios(c)}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                      {c.chave_pix && (
                        <p className="max-w-[220px] truncate text-xs text-[var(--text-muted)]" title={c.chave_pix}>
                          PIX: {c.chave_pix}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(c.saldo_inicial))}
                      <span className="block text-xs text-[var(--text-secondary)]">
                        ref. {formatDate(c.data_saldo_inicial)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleAtiva(c)}
                        title={c.ativa ? "Clique para inativar" : "Clique para ativar"}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 ${
                          c.ativa
                            ? "bg-[var(--success-bg)] text-[var(--success-text)]"
                            : "bg-[var(--danger-bg)] text-[var(--danger-text)]"
                        }`}
                      >
                        {c.ativa ? "Ativa" : "Inativa"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      {!c.principal && c.ativa && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Definir como principal"
                          aria-label={`Definir ${c.nome} como principal`}
                          onClick={() => togglePrincipal(c)}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Editar" aria-label={`Editar ${c.nome}`} onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!saving) setOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar conta" : "Nova conta bancária"}</DialogTitle>
            <DialogDescription>
              {form.id
                ? "Atualize os dados da conta usada no fluxo de caixa."
                : "Cadastre uma conta bancária, caixa físico ou carteira digital da agência."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="conta-nome">Nome *</Label>
              <Input
                id="conta-nome"
                value={form.nome}
                onChange={(e) => { setForm((f) => ({ ...f, nome: e.target.value })); setErrors((er) => ({ ...er, nome: undefined })); }}
                placeholder="Ex: Nubank PJ, Caixa Loja"
                aria-invalid={!!errors.nome}
                className={errors.nome ? "border-[var(--danger-text)]" : undefined}
              />
              {errors.nome && <p className="text-xs text-[var(--danger-text)]">{errors.nome}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-banco">Banco</Label>
              <Input
                id="conta-banco"
                value={form.banco}
                onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))}
                placeholder="Ex: Nubank, Itaú"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-tipo">Tipo</Label>
              <Select id="conta-tipo" value={form.tipo_conta} onChange={(e) => setForm((f) => ({ ...f, tipo_conta: e.target.value }))}>
                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-agencia">Agência</Label>
              <Input
                id="conta-agencia"
                value={form.agencia}
                onChange={(e) => setForm((f) => ({ ...f, agencia: e.target.value }))}
                placeholder="Ex: 0001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-numero">Número da conta</Label>
              <Input
                id="conta-numero"
                value={form.numero_conta}
                onChange={(e) => setForm((f) => ({ ...f, numero_conta: e.target.value }))}
                placeholder="Ex: 12345-6"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="conta-pix">Chave PIX</Label>
              <Input
                id="conta-pix"
                value={form.chave_pix}
                onChange={(e) => setForm((f) => ({ ...f, chave_pix: e.target.value }))}
                placeholder="CNPJ, e-mail, telefone ou chave aleatória"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-saldo">Saldo de referência</Label>
              <CurrencyInput
                id="conta-saldo"
                value={form.saldo_inicial}
                onValueChange={(v) => setForm((f) => ({ ...f, saldo_inicial: v ?? 0 }))}
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Saldo real da conta na data abaixo. Lançamentos recebidos/pagos até essa data já devem estar refletidos aqui.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-data-saldo">Data do saldo *</Label>
              <Input
                id="conta-data-saldo"
                type="date"
                value={form.data_saldo_inicial}
                onChange={(e) => { setForm((f) => ({ ...f, data_saldo_inicial: e.target.value })); setErrors((er) => ({ ...er, data: undefined })); }}
                aria-invalid={!!errors.data}
                className={errors.data ? "border-[var(--danger-text)]" : undefined}
              />
              {errors.data && <p className="text-xs text-[var(--danger-text)]">{errors.data}</p>}
              <p className="text-xs text-[var(--text-secondary)]">
                No fluxo de caixa, só entradas e saídas após essa data alteram o saldo da conta.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cor na interface</Label>
              <div className="flex flex-wrap gap-2">
                {CORES.map((cor) => {
                  const selected = form.cor === cor;
                  return (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, cor }))}
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-shadow ${
                        selected ? "ring-2 ring-[var(--accent-600)] ring-offset-2 ring-offset-[var(--bg-card)]" : "hover:opacity-80"
                      }`}
                      style={{ backgroundColor: cor }}
                      title={cor}
                      aria-label={`Cor ${cor}`}
                      aria-pressed={selected}
                    >
                      {selected && <Check className="h-4 w-4 text-white" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Usada para identificar a conta nos gráficos e no fluxo de caixa.</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border-subtle)] p-3 hover:bg-[var(--bg-hover)]">
              <input
                type="checkbox"
                checked={form.principal}
                onChange={(e) => setForm((f) => ({ ...f, principal: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-[var(--accent-600)]"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Conta principal</span>
                <span className="block text-xs text-[var(--text-secondary)]">Padrão nos lançamentos do fluxo de caixa.</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border-subtle)] p-3 hover:bg-[var(--bg-hover)]">
              <input
                type="checkbox"
                checked={form.ativa}
                onChange={(e) => setForm((f) => ({ ...f, ativa: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-[var(--accent-600)]"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Conta ativa</span>
                <span className="block text-xs text-[var(--text-secondary)]">Disponível para novos lançamentos.</span>
              </span>
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar conta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
