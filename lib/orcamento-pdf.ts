import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { formatCurrency } from "@/lib/format";

/** Dados fixos do modelo institucional (alinhados ao PDF de referência). */
const CONTATO_EMAIL = "contato@moovifly.com";
const CONTATO_SITE = "www.moovifly.com";
const CONTATO_FONE = "(11) 93476-2251";

const AVISO_CIA =
  "*Os valores informados poderão ser eventualmente alterados pela companhia aérea.";

const TEXTO_BAGAGEM_COM =
  "1 bagagem de até 23kg + 1 bagagem de mão + 1 bolsa ou mochila pessoal (por passageiro)";

export type VooPdf = {
  tipo: "ida" | "volta";
  origem: string;
  destino: string;
  data: string;
  horario_saida: string;
  horario_chegada: string;
  companhia: string;
  numero_voo: string;
};

export type OrcamentoPdfInput = {
  numero_orcamento?: string | null;
  data_orcamento: string;
  adultos: number;
  criancas: number;
  bebes: number;
  com_bagagem: boolean;
  voos: VooPdf[];
  valor_total: number | string;
  forma_pagamento: string | null;
  observacoes?: string | null;
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

/** Ex.: "30 de Abril, 2026" */
function formatDataExtenso(iso: string): string {
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

function celulaSaidaChegada(dataIso: string, horario: string): string {
  if (!dataIso && !horario.trim()) return "—";
  const d = formatDataCurta(dataIso);
  const h = formatHorarioComH(horario);
  if (d === "—" && h === "—") return "—";
  if (d === "—") return h;
  if (h === "—") return d;
  return `${d} ${h}`;
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

function linhaPassageiros(adultos: number, criancas: number, bebes: number): string {
  const parts: string[] = [];
  if (adultos > 0) parts.push(`${adultos} ${adultos === 1 ? "adulto" : "adultos"}`);
  if (criancas > 0) parts.push(`${criancas} ${criancas === 1 ? "criança" : "crianças"}`);
  if (bebes > 0) parts.push(`${bebes} ${bebes === 1 ? "bebê" : "bebês"}`);
  return parts.length ? parts.join(", ") : "0 passageiros";
}

function textoBagagem(comBagagem: boolean): string {
  if (!comBagagem) {
    return "Sem bagagem despachada incluída neste orçamento (somente bagagem de mão, conforme regra da companhia).";
  }
  return TEXTO_BAGAGEM_COM;
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const total = doc.getNumberOfPages();
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.text(`-- ${i} of ${total} --`, pageWidth / 2, pageHeight - 28, { align: "center" });
  }
}

/**
 * Gera o PDF no layout do modelo institucional (orçamento de voo).
 */
export function buildOrcamentoPdf(input: OrcamentoPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentW = pageWidth - margin * 2;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Orçamento", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const contatoLines = [CONTATO_EMAIL, CONTATO_SITE, CONTATO_FONE];
  let cy = y - 6;
  for (const line of contatoLines) {
    doc.text(line, pageWidth - margin, cy, { align: "right" });
    cy += 13;
  }

  y = Math.max(y + 8, cy) + 8;

  const subt = (input.numero_orcamento ?? "").trim();
  if (subt) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(subt, margin, y);
    y += 18;
  }

  doc.setFontSize(11);
  doc.text(formatDataExtenso(input.data_orcamento), margin, y);
  y += 20;

  doc.setFontSize(10);
  doc.text(linhaPassageiros(input.adultos, input.criancas, input.bebes), margin, y);
  y += 16;

  const bagLines = doc.splitTextToSize(textoBagagem(input.com_bagagem), contentW);
  doc.text(bagLines, margin, y);
  y += bagLines.length * 13 + 18;

  const voos = input.voos ?? [];
  const bodyRows =
    voos.length > 0
      ? voos.map((v) => [
          v.companhia || "—",
          String(v.numero_voo || "—"),
          celulaSaidaChegada(v.data, v.horario_saida),
          celulaSaidaChegada(v.data, v.horario_chegada),
          v.origem || "—",
          v.destino || "—",
          duracaoEntre(v.horario_saida, v.horario_chegada),
        ])
      : [["—", "—", "—", "—", "—", "—", "—"]];

  autoTable(doc, {
    startY: y,
    head: [["Cia", "Voo", "Saída", "Chegada", "Origem", "Destino", "Dur."]],
    body: bodyRows,
    styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 32 },
      2: { cellWidth: 62 },
      3: { cellWidth: 62 },
      4: { cellWidth: 78 },
      5: { cellWidth: 78 },
      6: { cellWidth: 34 },
    },
    margin: { left: margin, right: margin },
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.5,
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  y = finalY + 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(formatCurrency(Number(input.valor_total)), margin, y);

  y += 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Formas de Pagamento:", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  const formas = (input.forma_pagamento ?? "").trim() || "—";
  const formasLines = doc.splitTextToSize(formas, contentW);
  doc.text(formasLines, margin, y);
  y += formasLines.length * 12 + 14;

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const avisoLines = doc.splitTextToSize(AVISO_CIA, contentW);
  doc.text(avisoLines, margin, y);
  y += avisoLines.length * 11 + 10;
  doc.setTextColor(0, 0, 0);

  const obs = (input.observacoes ?? "").trim();
  if (obs) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    const obsLines = doc.splitTextToSize(`Obs.: ${obs}`, contentW);
    doc.text(obsLines, margin, y);
    doc.setFont("helvetica", "normal");
  }

  drawFooter(doc, pageWidth, pageHeight);
  return doc;
}

export function downloadOrcamentoPdf(input: OrcamentoPdfInput, filename: string) {
  const doc = buildOrcamentoPdf(input);
  doc.save(filename);
}
