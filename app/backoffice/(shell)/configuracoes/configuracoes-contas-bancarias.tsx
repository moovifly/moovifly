"use client";

import { Pencil, Plus, Star } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { showConfirm } from "@/components/confirm-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
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

export function ConfiguracoesContasBancarias() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [items, setItems] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

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

  function openNew() {
    setForm(emptyForm());
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
    setOpen(true);
  }

  async function clearOtherPrincipal(exceptId?: string) {
    let q = supabase.from("contas_bancarias").update({ principal: false }).eq("principal", true);
    if (exceptId) q = q.neq("id", exceptId);
    await q;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome da conta.");
      return;
    }
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
      message: `${c.ativa ? "Inativar" : "Ativar"} a conta "${c.nome}"?`,
      confirmText: c.ativa ? "Inativar" : "Ativar",
    });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("contas_bancarias")
        .update({ ativa: !c.ativa, principal: c.ativa && c.principal ? false : c.principal })
        .eq("id", c.id);
      if (error) throw error;
      toast.success("Status atualizado.");
      load();
    } catch (err) {
      toast.error("Erro ao atualizar", { description: formatSupabaseError(err) });
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contas Bancárias e Caixa</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
              Nenhuma conta cadastrada. Adicione a conta principal da agência para usar no fluxo de caixa.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Saldo inicial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id} className={!c.ativa ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.cor }} />
                        <span className="font-medium">{c.nome}</span>
                        {c.principal && (
                          <span className="rounded-full bg-[var(--accent-glow)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-600)]">
                            Principal
                          </span>
                        )}
                      </div>
                      {c.banco && <p className="text-xs text-[var(--text-secondary)]">{c.banco}</p>}
                    </TableCell>
                    <TableCell>{TIPO_LABEL[c.tipo_conta] ?? c.tipo_conta}</TableCell>
                    <TableCell>
                      {formatCurrency(Number(c.saldo_inicial))}
                      <span className="block text-xs text-[var(--text-secondary)]">
                        ref. {formatDate(c.data_saldo_inicial)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleAtiva(c)}
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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
                        <Button variant="ghost" size="icon" title="Definir principal" onClick={() => togglePrincipal(c)}>
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(c)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar conta" : "Nova conta bancária"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Nubank PJ, Caixa Loja"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input value={form.banco} onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo_conta} onChange={(e) => setForm((f) => ({ ...f, tipo_conta: e.target.value }))}>
                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Agência</Label>
              <Input value={form.agencia} onChange={(e) => setForm((f) => ({ ...f, agencia: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input
                value={form.numero_conta}
                onChange={(e) => setForm((f) => ({ ...f, numero_conta: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Chave PIX</Label>
              <Input value={form.chave_pix} onChange={(e) => setForm((f) => ({ ...f, chave_pix: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Saldo inicial</Label>
              <CurrencyInput
                value={form.saldo_inicial}
                onValueChange={(v) => setForm((f) => ({ ...f, saldo_inicial: v ?? 0 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data do saldo</Label>
              <Input
                type="date"
                value={form.data_saldo_inicial}
                onChange={(e) => setForm((f) => ({ ...f, data_saldo_inicial: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cor na interface</Label>
              <div className="flex flex-wrap gap-2">
                {CORES.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, cor }))}
                    className={`h-8 w-8 rounded-full border-2 ${form.cor === cor ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: cor }}
                    title={cor}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Principal</Label>
              <Select
                value={form.principal ? "true" : "false"}
                onChange={(e) => setForm((f) => ({ ...f, principal: e.target.value === "true" }))}
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ativa</Label>
              <Select
                value={form.ativa ? "true" : "false"}
                onChange={(e) => setForm((f) => ({ ...f, ativa: e.target.value === "true" }))}
              >
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </Select>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : form.id ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
