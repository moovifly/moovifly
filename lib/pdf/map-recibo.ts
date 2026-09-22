import { formatCpfCnpj, formatCurrency, formatPhoneBR } from "@/lib/format";
import { EMPRESA_MOOVIFLY } from "@/lib/pdf/empresa";
import type { DadosRecibo, ReciboTrecho } from "@/lib/pdf/recibo-types";
import { valorPorExtenso } from "@/lib/pdf/valor-extenso";
import { parseVoosJson, type Voo } from "@/lib/voos";

export type VendaReciboRow = {
  id: string;
  numero_venda: string | null;
  data_venda: string | null;
  categoria_venda: string | null;
  tipo: string | null;
  origem: string | null;
  destino: string | null;
  companhia: string | null;
  localizador: string | null;
  voucher: string | null;
  data_ida: string | null;
  data_volta: string | null;
  valor_total: number | string | null;
  taxa_rav: number | string | null;
  taxa_du: number | string | null;
  forma_pagamento: string | null;
  voos?: unknown;
  passageiros_dados?: unknown;
  cliente?: {
    nome?: string | null;
    email?: string | null;
    telefone?: string | null;
    cpf?: string | null;
    rg?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
  } | null;
};

function parseLocalDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  const part = iso.trim().slice(0, 10);
  const [y, m, d] = part.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date(iso);
  }
  return new Date(y, m - 1, d);
}

function formatDataCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function formatHora(horario: string | null | undefined): string {
  const t = (horario ?? "").trim();
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function formatDataHora(dataIso: string | null | undefined, horario: string | null | undefined): string {
  const data = formatDataCurta(dataIso);
  const hora = formatHora(horario);
  if (!data && !hora) return "";
  if (!hora) return data;
  if (!data) return hora;
  return `${data} ${hora}`;
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function formatDataExtensoRecibo(iso: string | Date): string {
  const d = typeof iso === "string" ? parseLocalDate(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`;
}

function toMoney(n: number): string {
  return formatCurrency(n).replace(/\s/g, "");
}

/** Exibe valor sem "R$" quando o layout já indica a moeda (coluna Total do rodapé). */
function toMoneyPlain(n: number): string {
  return formatCurrency(n).replace(/^R\$\s?/, "");
}

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function splitOrigemDestino(s: string): { codigo: string; cidade: string } {
  const t = s.trim();
  if (!t) return { codigo: "", cidade: "" };
  const idx = t.indexOf(" - ");
  if (idx === -1) {
    // Pode ser só IATA (3 letras) ou só cidade
    if (/^[A-Z]{3}$/i.test(t)) return { codigo: t.toUpperCase(), cidade: "" };
    return { codigo: "", cidade: t };
  }
  return { codigo: t.slice(0, idx).trim(), cidade: t.slice(idx + 3).trim() };
}

function linhaLocal(codigo: string, cidade: string): string {
  const co = codigo.trim();
  const ci = cidade.trim().toUpperCase();
  if (co && ci) return `${co}  ${ci}`;
  return co || ci || "";
}

function ciaCodigo(companhia: string): string {
  const t = companhia.trim();
  if (!t) return "";
  // "Latam" / "LATAM Airlines" → tenta iniciais conhecidas
  const known: Record<string, string> = {
    latam: "LA",
    gol: "G3",
    azul: "AD",
    tap: "TP",
    avianca: "AV",
  };
  const key = t.toLowerCase().split(/\s+/)[0] ?? "";
  if (known[key]) return known[key]!;
  if (/^[A-Z0-9]{2}$/i.test(t)) return t.toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

function vooToTrecho(v: Voo): ReciboTrecho {
  const orig = splitOrigemDestino(v.origem);
  const dst = splitOrigemDestino(v.destino);
  return {
    cia: ciaCodigo(v.companhia) || ciaCodigo(""),
    voo: (v.numero_voo ?? "").trim(),
    classe: "",
    origemLinha: linhaLocal(orig.codigo, orig.cidade),
    destinoLinha: linhaLocal(dst.codigo, dst.cidade),
    saida: formatDataHora(v.data_partida, v.horario_saida),
    chegada: formatDataHora(v.data_chegada, v.horario_chegada),
  };
}

function parsePassageiros(raw: unknown): { nome: string; documento: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const o = p as Record<string, unknown>;
      const nome = String(o.nome ?? "").trim();
      if (!nome) return null;
      return { nome, documento: String(o.documento ?? "").trim() };
    })
    .filter((x): x is { nome: string; documento: string } => x != null);
}

function produtoTitulo(categoria: string | null, tipo: string | null): string {
  if (categoria === "seguro_viagem") return "Seguro Viagem";
  if (categoria === "servico") {
    const t = (tipo ?? "").trim();
    return t || "Serviço";
  }
  return "Passagem Aérea";
}

function formaPagamentoLabel(forma: string | null): string {
  const t = (forma ?? "").trim();
  if (!t) return "";
  if (/^à\s*vista$/i.test(t) || /^pix$/i.test(t)) return "Pagamento via Pix";
  if (/pix/i.test(t)) return t.startsWith("Pagamento") ? t : `Pagamento via ${t}`;
  return t.startsWith("Pagamento") ? t : `Pagamento via ${t}`;
}

export function vendaToDadosRecibo(venda: VendaReciboRow, dataEmissao = new Date()): DadosRecibo {
  const cliente = venda.cliente ?? {};
  const total = num(venda.valor_total);
  const taxaDu = num(venda.taxa_du);
  const taxaRav = num(venda.taxa_rav);
  const taxasRodape = taxaDu + taxaRav;
  const produtos = Math.max(0, Math.round((total - taxasRodape) * 100) / 100);

  const dataVenda = formatDataCurta(venda.data_venda);
  const numero = (venda.numero_venda ?? "").replace(/^VEN/i, "").trim() || "—";
  const tituloFaixa = `RECIBO - VENDA ${numero} - ${dataVenda || "—"}`;

  const voos = parseVoosJson(venda.voos);
  const trechos =
    (venda.categoria_venda ?? "aereo") === "aereo" ? voos.map(vooToTrecho) : [];

  const passageiros = parsePassageiros(venda.passageiros_dados);
  const paxLinhas =
    passageiros.length > 0
      ? passageiros.map((p) => ({
          nome: p.nome.toUpperCase(),
          bilhete: "",
          centroCusto: "",
        }))
      : [{ nome: "", bilhete: "", centroCusto: "" }];

  const loc = (venda.localizador ?? venda.voucher ?? "").trim().toUpperCase();
  const categoria = venda.categoria_venda ?? "aereo";

  let produtoDetalhe: string | undefined;
  if (categoria !== "aereo") {
    const bits: string[] = [];
    if (venda.destino) bits.push(venda.destino);
    const ida = formatDataCurta(venda.data_ida);
    const volta = formatDataCurta(venda.data_volta);
    if (ida || volta) bits.push([ida, volta].filter(Boolean).join(" — "));
    if (loc) bits.push(`Localizador/Voucher: ${loc}`);
    produtoDetalhe = bits.join(" · ") || undefined;
  }

  return {
    tituloFaixa,
    pagante: {
      nome: (cliente.nome ?? "").trim(),
      endereco: (cliente.endereco ?? "").trim(),
      bairro: "",
      cidade: (cliente.cidade ?? "").trim(),
      uf: (cliente.estado ?? "").trim(),
      cep: (cliente.cep ?? "").trim(),
      cpfCnpj: formatCpfCnpj(cliente.cpf),
      ieRg: (cliente.rg ?? "").trim(),
      telefones: formatPhoneBR(cliente.telefone),
      email: (cliente.email ?? "").trim(),
    },
    produtoTitulo: produtoTitulo(categoria, venda.tipo),
    companhia: (venda.companhia ?? "").trim(),
    localizador: loc,
    produtoDetalhe,
    trechos,
    passageiros: paxLinhas,
    valores: {
      produtos: toMoney(produtos),
      abatimentos: toMoney(0),
      taxaDu: toMoney(taxaDu),
      taxas: toMoney(taxaRav),
      taxasRodape: toMoney(taxasRodape),
      total: toMoneyPlain(total),
      valorNumerico: formatCurrency(total),
      valorExtenso: valorPorExtenso(total),
    },
    formaPagamento: formaPagamentoLabel(venda.forma_pagamento),
    dataPagamento: dataVenda,
    dataEmissaoExtenso: `${EMPRESA_MOOVIFLY.cidadeEmissao}, ${formatDataExtensoRecibo(dataEmissao)}`,
  };
}
