/** Dados de financiamento por IATA extraídos da BRT Consolidadora. */

type DadosFinanciamento = {
  nome: string;
  financiamento: string;
  cartoes: string[];
};

const FINANCIAMENTO_POR_IATA: Record<string, DadosFinanciamento> = {
  // Nacionais
  AD: { nome: "Azul", financiamento: "Em até 10x sem juros e em até 12x com juros", cartoes: ["Amex", "Dinners", "Elo", "Hipercard", "Mastercard", "Visa"] },
  G3: { nome: "Gol", financiamento: "Em até 4x sem juros; de 5 a 12x com acréscimo de 1,99% ao mês", cartoes: ["Visa", "Mastercard", "Dinners", "Amex", "Elo", "JCB"] },
  JJ: { nome: "LATAM", financiamento: "Em até 4x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Hipercard", "Mastercard", "Visa"] },
  "2Z": { nome: "VoePass", financiamento: "Sem informações de parcelamento", cartoes: [] },
  // Internacionais
  AR: { nome: "Aerolineas", financiamento: "Em até 6x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  AM: { nome: "Aeroméxico", financiamento: "Em até 12x sem juros", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  AC: { nome: "Air Canada", financiamento: "Em até 6x sem juros", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  CA: { nome: "Air China", financiamento: "Em até 5x sem juros", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  UX: { nome: "Air Europa", financiamento: "Em até 10x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  AF: { nome: "Air France", financiamento: "Em até 4x sem juros (GDS)", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  NZ: { nome: "Air New Zealand", financiamento: "Em até 6x sem juros", cartoes: ["Amex", "Mastercard", "Visa"] },
  AA: { nome: "American Airlines", financiamento: "Em até 6x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Hipercard", "Mastercard", "Visa"] },
  NH: { nome: "ANA", financiamento: "Em até 5x sem juros", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  AV: { nome: "Avianca", financiamento: "Em até 10x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  OB: { nome: "BOA", financiamento: "Em até 6x sem juros", cartoes: ["Dinners", "Mastercard", "Visa", "Amex (apenas à vista)"] },
  BA: { nome: "British Airways", financiamento: "Em até 10x sem juros (voos saindo do BR)", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  CX: { nome: "Cathay Pacific", financiamento: "Somente pagamento à vista", cartoes: [] },
  CM: { nome: "Copa Airlines", financiamento: "Em até 6x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  DL: { nome: "Delta", financiamento: "Em até 6x sem juros", cartoes: ["Amex", "Mastercard", "Visa"] },
  LY: { nome: "El Al", financiamento: "Em até 3x sem juros", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  EK: { nome: "Emirates", financiamento: "À vista, ou em 3x, 5x ou 9x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  ET: { nome: "Ethiopian", financiamento: "Em até 6x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  HR: { nome: "Hahn Air", financiamento: "Em 1x", cartoes: ["Visa", "Mastercard"] },
  IB: { nome: "Iberia", financiamento: "Em até 10x sem juros (voos saindo do BR)", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  AZ: { nome: "ITA Airways", financiamento: "Em até 6x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  JL: { nome: "Japan Air Lines (JAL)", financiamento: "Somente à vista", cartoes: [] },
  JA: { nome: "JETSMART", financiamento: "Em até 6x sem juros", cartoes: ["Mastercard", "Visa", "Dinners"] },
  KL: { nome: "KLM", financiamento: "Em até 4x sem juros (GDS)", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  KE: { nome: "Korean Air", financiamento: "Somente à vista", cartoes: [] },
  LH: { nome: "Lufthansa", financiamento: "Em até 5x sem juros (GDS) ou 10x (NDC)", cartoes: ["Amex", "Dinners", "Mastercard", "Visa", "Elo"] },
  QF: { nome: "Qantas", financiamento: "Em até 5x sem juros", cartoes: ["Mastercard", "Visa"] },
  QR: { nome: "Qatar", financiamento: "Em até 5x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  AT: { nome: "Royal Air Maroc", financiamento: "Em até 10x sem juros", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  SQ: { nome: "Singapore Airlines", financiamento: "Em até 5x sem juros", cartoes: ["Amex", "Mastercard", "Visa"] },
  H2: { nome: "Sky Airline", financiamento: "Em até 3x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  SA: { nome: "South African", financiamento: "Em até 10x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  LX: { nome: "Swiss", financiamento: "Em até 5x sem juros (GDS) ou 10x (NDC)", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  DT: { nome: "TAAG", financiamento: "Em 4x", cartoes: ["Amex", "Dinners", "Mastercard", "Visa"] },
  TP: { nome: "TAP", financiamento: "Em até 10x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
  TK: { nome: "Turkish Airlines", financiamento: "À vista ou em 5x sem juros", cartoes: ["Amex", "Elo", "Mastercard", "Visa"] },
  UA: { nome: "United", financiamento: "Em até 5x sem juros", cartoes: ["Amex", "Dinners", "Elo", "Mastercard", "Visa"] },
};

function listaCartoes(cartoes: string[]): string {
  if (cartoes.length === 0) return "";
  if (cartoes.length === 1) return cartoes[0]!;
  return cartoes.slice(0, -1).join(", ") + " e " + cartoes.at(-1);
}

/**
 * Retorna o texto de forma de pagamento para uma companhia dado seu código IATA.
 * Retorna null se a companhia não for encontrada.
 */
export function getFormaPagamento(iata: string): string | null {
  const d = FINANCIAMENTO_POR_IATA[iata.toUpperCase()];
  if (!d) return null;
  const cartoesPart = d.cartoes.length > 0 ? `, nos cartões ${listaCartoes(d.cartoes)}` : "";
  return `${d.financiamento}${cartoesPart}. Pix ou transferência bancária.`;
}
