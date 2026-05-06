import { formatCurrency } from "@/lib/format";
import type { OrcamentoPdfInput, VooPdf } from "@/lib/orcamento-pdf-types";
import type {
  AgenciaOrcamento,
  BagagemOrcamento,
  DadosOrcamento,
  PassageirosOrcamento,
  VooOrcamento,
} from "@/lib/pdf/orcamento-types";

const AGENCIA_PADRAO: AgenciaOrcamento = {
  nome: "Moovifly",
  email: "contato@moovifly.com",
  site: "www.moovifly.com",
  telefone: "(11) 93476-2251",
};

const NOTA_PADRAO =
  "*Os valores informados poderão ser eventualmente alterados pela companhia aérea.";

function parseLocalDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  const part = iso.trim().slice(0, 10);
  const [y, m, d] = part.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date(iso);
  }
  return new Date(y, m - 1, d);
}

/** Ex.: "30 de Abril, 2026" */
export function formatDataExtensoOrcamento(iso: string): string {
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  const meses = [
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
  return `${d.getDate()} de ${meses[d.getMonth()]}, ${d.getFullYear()}`;
}

/** DD/MM/AA */
function formatDataCurta(iso: string): string {
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function formatHorarioComH(horario: string): string {
  const t = horario.trim();
  if (!t) return "—";
  const short = t.length >= 5 ? t.slice(0, 5) : t;
  return short.endsWith("h") ? short : `${short}h`;
}

function duracaoEntre(horarioSaida: string, horarioChegada: string): string {
  const parseMin = (h: string) => {
    const m = h.trim().match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };
  const a = parseMin(horarioSaida);
  const b = parseMin(horarioChegada);
  if (a === null || b === null) return "—";
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  const hh = Math.floor(diff / 60);
  const mm = diff % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function splitCodigoCidade(s: string): { codigo: string; cidade: string } {
  const t = s.trim();
  const idx = t.indexOf(" - ");
  if (idx === -1) return { codigo: t || "—", cidade: "" };
  return { codigo: t.slice(0, idx).trim() || "—", cidade: t.slice(idx + 3).trim() };
}

function clampInt(n: number, { min, max }: { min: number; max: number }) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function normalizeBagagens(input: OrcamentoPdfInput["bagagens"]) {
  return {
    bolsa: clampInt(Number(input?.bolsa ?? 0), { min: 0, max: 99 }),
    mao: clampInt(Number(input?.mao ?? 0), { min: 0, max: 99 }),
    grande: clampInt(Number(input?.grande ?? 0), { min: 0, max: 99 }),
  };
}

function passageirosNormalizados(p: PassageirosOrcamento): PassageirosOrcamento {
  return {
    adultos: Math.max(0, p.adultos ?? 0),
    criancas: Math.max(0, p.criancas ?? 0),
    bebes: Math.max(0, p.bebes ?? 0),
  };
}

/** Alinha ao gerar_orcamento.py: sufixo (por passageiro) se mão ou bolsa. */
function linhaBagagemFromInput(input: OrcamentoPdfInput): { texto: string; estrutura: BagagemOrcamento } {
  const bCount = normalizeBagagens(input.bagagens);
  const temAlguma = bCount.bolsa + bCount.mao + bCount.grande > 0;

  if (!temAlguma && !input.com_bagagem) {
    return {
      texto:
        "Sem bagagem despachada incluída neste orçamento (somente bagagem de mão, conforme regra da companhia).",
      estrutura: {},
    };
  }

  const parts: string[] = [];
  if (bCount.grande > 0) {
    parts.push(
      `${bCount.grande} ${bCount.grande === 1 ? "bagagem de até 23kg" : "bagagens de até 23kg"}`,
    );
  }
  if (bCount.mao > 0) {
    parts.push(
      `${bCount.mao} ${bCount.mao === 1 ? "bagagem de mão" : "bagagens de mão"}`,
    );
  }
  if (bCount.bolsa > 0) {
    parts.push(
      `${bCount.bolsa} ${bCount.bolsa === 1 ? "bolsa ou mochila pessoal" : "bolsas ou mochilas pessoais"}`,
    );
  }

  let texto = parts.join(" + ");
  if (bCount.mao > 0 || bCount.bolsa > 0) {
    texto += " (por passageiro)";
  }

  const estrutura: BagagemOrcamento = {};
  if (bCount.grande > 0) estrutura.despachada = "23kg";
  if (bCount.mao > 0) estrutura.mao = true;
  if (bCount.bolsa > 0) estrutura.bolsa = true;

  return { texto, estrutura };
}

export function textoLinhaPassageiros(p: PassageirosOrcamento): string {
  const parts: string[] = [];
  if (p.adultos > 0) parts.push(`${p.adultos} adulto${p.adultos > 1 ? "s" : ""}`);
  if ((p.criancas ?? 0) > 0)
    parts.push(`${p.criancas} criança${(p.criancas ?? 0) > 1 ? "s" : ""}`);
  if ((p.bebes ?? 0) > 0) parts.push(`${p.bebes} bebê${(p.bebes ?? 0) > 1 ? "s" : ""}`);
  return parts.length ? parts.join(", ") : "0 passageiros";
}

function vooPdfParaOrcamento(v: VooPdf): VooOrcamento {
  const orig = splitCodigoCidade(v.origem ?? "");
  const dst = splitCodigoCidade(v.destino ?? "");
  return {
    cia: (v.companhia ?? "").trim() || "—",
    numero: String(v.numero_voo ?? "").trim() || "—",
    dataSaida: formatDataCurta(v.data),
    horaSaida: formatHorarioComH(v.horario_saida),
    dataChegada: formatDataCurta(v.data),
    horaChegada: formatHorarioComH(v.horario_chegada),
    origemCodigo: orig.codigo,
    origemCidade: orig.cidade,
    destinoCodigo: dst.codigo,
    destinoCidade: dst.cidade,
    duracao: duracaoEntre(v.horario_saida, v.horario_chegada),
  };
}

function formasPagamentoLista(forma: string | null): string[] {
  const t = (forma ?? "").trim();
  if (!t) return ["—"];
  const linhas = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return linhas.length ? linhas : ["—"];
}

function logoPublicUrl(): string | undefined {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_AGENCIA_LOGO_URL) {
    return process.env.NEXT_PUBLIC_AGENCIA_LOGO_URL;
  }
  return undefined;
}

/**
 * Converte o modelo usado pelo backoffice (`OrcamentoPdfInput`) para o contrato do SPEC.
 */
export function orcamentoPdfInputToDados(input: OrcamentoPdfInput): DadosOrcamento {
  const passageiros = passageirosNormalizados({
    adultos: input.adultos ?? 0,
    criancas: input.criancas ?? 0,
    bebes: input.bebes ?? 0,
  });

  const { texto: linhaBagagem, estrutura: bagagem } = linhaBagagemFromInput(input);

  const voosRaw = input.voos?.length
    ? input.voos.map(vooPdfParaOrcamento)
    : [
        {
          cia: "—",
          numero: "—",
          dataSaida: "—",
          horaSaida: "—",
          dataChegada: "—",
          horaChegada: "—",
          origemCodigo: "—",
          origemCidade: "",
          destinoCodigo: "—",
          destinoCidade: "",
          duracao: "—",
        },
      ];

  const valorNum = input.valor_total;
  const valorTotal =
    typeof valorNum === "number" ? formatCurrency(valorNum) : formatCurrency(Number(valorNum));

  const logoPath = logoPublicUrl();

  return {
    agencia: {
      ...AGENCIA_PADRAO,
      ...(logoPath ? { logoPath } : {}),
    },
    dataOrcamento: formatDataExtensoOrcamento(input.data_orcamento),
    passageiros,
    bagagem,
    linhaBagagem,
    voos: voosRaw,
    valorTotal,
    formasPagamento: formasPagamentoLista(input.forma_pagamento),
    notaRodape: NOTA_PADRAO,
    observacoes: (input.observacoes ?? "").trim() || undefined,
  };
}
