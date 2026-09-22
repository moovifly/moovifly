"use client";

import { FileDown, Loader2, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Topbar } from "@/components/backoffice/topbar";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCpfCnpj, formatCurrency, formatDate, formatPhoneBR } from "@/lib/format";
import type { ReciboPagante } from "@/lib/pdf/recibo-types";
import { downloadReciboPdf } from "@/lib/recibo-pdf-download";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { cn } from "@/lib/utils";

type VendaLista = {
  id: string;
  numero_venda: string;
  data_venda: string;
  valor_total: number | string;
  status: string;
  categoria_venda: string | null;
  destino: string | null;
  localizador: string | null;
  cliente_id: string | null;
  cliente?: { nome: string } | null;
};

type ClientePagante = {
  nome: string | null;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  rg: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
};

const emptyPagante = (): ReciboPagante => ({
  nome: "",
  endereco: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  cpfCnpj: "",
  ieRg: "",
  telefones: "",
  email: "",
});

function clienteToPagante(c: ClientePagante | null | undefined): ReciboPagante {
  if (!c) return emptyPagante();
  return {
    nome: (c.nome ?? "").trim(),
    endereco: (c.endereco ?? "").trim(),
    bairro: "",
    cidade: (c.cidade ?? "").trim(),
    uf: (c.estado ?? "").trim(),
    cep: (c.cep ?? "").trim(),
    cpfCnpj: formatCpfCnpj(c.cpf),
    ieRg: (c.rg ?? "").trim(),
    telefones: formatPhoneBR(c.telefone),
    email: (c.email ?? "").trim(),
  };
}

function categoriaLabel(cat: string | null | undefined) {
  if (cat === "seguro_viagem") return "Seguro";
  if (cat === "servico") return "Serviço";
  return "Aéreo";
}

function categoriaBadge(cat: string | null | undefined) {
  if (cat === "seguro_viagem") return "info" as const;
  if (cat === "servico") return "warning" as const;
  return "default" as const;
}

export function ReciboClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { profile } = useAuth();
  const [items, setItems] = useState<VendaLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [clienteBase, setClienteBase] = useState<ClientePagante | null>(null);
  const [pagante, setPagante] = useState<ReciboPagante>(emptyPagante);

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("vendas")
        .select(
          "id, numero_venda, data_venda, valor_total, status, categoria_venda, destino, localizador, cliente_id, cliente:clientes(nome)",
        )
        .order("data_venda", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      if (profile?.tipo === "vendedor") {
        q = q.eq("vendedor_id", profile.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      setItems((data ?? []) as unknown as VendaLista[]);
    } catch (err) {
      toast.error("Erro ao carregar vendas", { description: formatSupabaseError(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!profile) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.tipo]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((v) => {
      const nome = (v.cliente?.nome ?? "").toLowerCase();
      const num = (v.numero_venda ?? "").toLowerCase();
      const dest = (v.destino ?? "").toLowerCase();
      const loc = (v.localizador ?? "").toLowerCase();
      return nome.includes(term) || num.includes(term) || dest.includes(term) || loc.includes(term);
    });
  }, [items, search]);

  const selected = useMemo(
    () => filtered.find((v) => v.id === selectedId) ?? items.find((v) => v.id === selectedId) ?? null,
    [filtered, items, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setClienteBase(null);
      setPagante(emptyPagante());
      return;
    }

    let cancelled = false;
    async function loadCliente() {
      setLoadingCliente(true);
      try {
        if (!selected!.cliente_id) {
          if (!cancelled) {
            setClienteBase(null);
            setPagante(emptyPagante());
          }
          return;
        }
        const { data, error } = await supabase
          .from("clientes")
          .select("nome, email, telefone, cpf, rg, endereco, cidade, estado, cep")
          .eq("id", selected!.cliente_id)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const cli = (data ?? null) as ClientePagante | null;
        setClienteBase(cli);
        setPagante(clienteToPagante(cli));
      } catch (err) {
        if (!cancelled) {
          toast.error("Erro ao carregar cliente", { description: formatSupabaseError(err) });
          setClienteBase(null);
          setPagante(emptyPagante());
        }
      } finally {
        if (!cancelled) setLoadingCliente(false);
      }
    }

    void loadCliente();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.cliente_id, supabase]);

  function setPaganteField(field: keyof ReciboPagante, value: string) {
    setPagante((p) => ({ ...p, [field]: value }));
  }

  function restaurarCliente() {
    setPagante(clienteToPagante(clienteBase));
    toast.success("Dados do cliente restaurados.");
  }

  async function handleGerar() {
    if (!selected) {
      toast.error("Selecione uma venda para gerar o recibo.");
      return;
    }
    if (!pagante.nome.trim()) {
      toast.error("Informe o nome do pagante.");
      return;
    }
    setGenerating(true);
    try {
      const filename = `Recibo-${selected.numero_venda || selected.id.slice(0, 8)}.pdf`;
      await downloadReciboPdf(selected.id, filename, {
        ...pagante,
        nome: pagante.nome.trim(),
      });
      toast.success("Recibo gerado com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar recibo");
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = Boolean(selected && pagante.nome.trim() && !generating && !loadingCliente);

  return (
    <>
      <Topbar
        title="Recibo"
        subtitle="Gere o PDF do recibo a partir de uma venda"
        actions={
          <Button onClick={handleGerar} disabled={!canGenerate}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Gerar recibo
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        {selected && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Venda selecionada</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">
                    #{selected.numero_venda} · {selected.cliente?.nome ?? "Sem cliente"}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDate(selected.data_venda)} · {formatCurrency(Number(selected.valor_total))} ·{" "}
                    {categoriaLabel(selected.categoria_venda)}
                    {selected.destino ? ` · ${selected.destino}` : ""}
                  </p>
                </div>
                <Button onClick={handleGerar} disabled={!canGenerate} className="shrink-0">
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  Gerar recibo
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Dados do pagante</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Edite se quem paga for outra pessoa ou empresa. Passageiros e valores
                    continuam da venda.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={restaurarCliente}
                  disabled={loadingCliente || !clienteBase}
                >
                  <RotateCcw className="h-4 w-4" />
                  Usar dados do cliente
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCliente ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pagante-nome">Nome *</Label>
                      <Input
                        id="pagante-nome"
                        value={pagante.nome}
                        onChange={(e) => setPaganteField("nome", e.target.value)}
                        placeholder="Nome completo ou razão social"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pagante-cpf">CPF/CNPJ</Label>
                      <Input
                        id="pagante-cpf"
                        value={pagante.cpfCnpj}
                        onChange={(e) => setPaganteField("cpfCnpj", e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pagante-rg">IE/RG</Label>
                      <Input
                        id="pagante-rg"
                        value={pagante.ieRg}
                        onChange={(e) => setPaganteField("ieRg", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="pagante-endereco">Endereço</Label>
                      <Input
                        id="pagante-endereco"
                        value={pagante.endereco}
                        onChange={(e) => setPaganteField("endereco", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pagante-bairro">Bairro</Label>
                      <Input
                        id="pagante-bairro"
                        value={pagante.bairro}
                        onChange={(e) => setPaganteField("bairro", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pagante-cidade">Cidade</Label>
                      <Input
                        id="pagante-cidade"
                        value={pagante.cidade}
                        onChange={(e) => setPaganteField("cidade", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pagante-uf">UF</Label>
                      <Input
                        id="pagante-uf"
                        value={pagante.uf}
                        onChange={(e) => setPaganteField("uf", e.target.value)}
                        maxLength={2}
                        className="uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pagante-cep">CEP</Label>
                      <Input
                        id="pagante-cep"
                        value={pagante.cep}
                        onChange={(e) => setPaganteField("cep", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pagante-tel">Telefones</Label>
                      <Input
                        id="pagante-tel"
                        value={pagante.telefones}
                        onChange={(e) => setPaganteField("telefones", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pagante-email">E-mail</Label>
                      <Input
                        id="pagante-email"
                        type="email"
                        value={pagante.email}
                        onChange={(e) => setPaganteField("email", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Escolher venda</CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar número, cliente, destino..."
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma venda encontrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden md:table-cell">Categoria</TableHead>
                      <TableHead className="hidden lg:table-cell">Destino</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((v) => {
                      const active = selectedId === v.id;
                      return (
                        <TableRow
                          key={v.id}
                          role="button"
                          tabIndex={0}
                          aria-selected={active}
                          onClick={() => setSelectedId(v.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(v.id);
                            }
                          }}
                          className={cn(
                            "cursor-pointer",
                            active && "bg-[var(--accent-glow)]",
                          )}
                        >
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex h-4 w-4 items-center justify-center rounded-full border",
                                active
                                  ? "border-[var(--accent-600)] bg-[var(--accent-600)]"
                                  : "border-[var(--border-subtle)]",
                              )}
                              aria-hidden
                            >
                              {active && (
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{v.numero_venda}</TableCell>
                          <TableCell className="font-medium">
                            {v.cliente?.nome ?? "—"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={categoriaBadge(v.categoria_venda)}>
                              {categoriaLabel(v.categoria_venda)}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden max-w-[180px] truncate lg:table-cell">
                            {v.destino ?? "—"}
                          </TableCell>
                          <TableCell>{formatDate(v.data_venda)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(Number(v.valor_total))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
