const UNIDADES = [
  "",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
];
const ESPECIAIS = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

function tresDigitos(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts: string[] = [];

  if (c > 0) parts.push(CENTENAS[c]!);
  if (d === 1) {
    parts.push(ESPECIAIS[u]!);
  } else {
    if (d > 1) parts.push(DEZENAS[d]!);
    if (u > 0) parts.push(UNIDADES[u]!);
  }
  return parts.join(" e ");
}

function inteiroExtenso(n: number): string {
  if (n === 0) return "zero";

  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];

  if (milhoes > 0) {
    parts.push(
      milhoes === 1 ? "um milhão" : `${tresDigitos(milhoes)} milhões`,
    );
  }
  if (milhares > 0) {
    parts.push(milhares === 1 ? "mil" : `${tresDigitos(milhares)} mil`);
  }
  if (resto > 0) parts.push(tresDigitos(resto));

  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
  return `${parts[0]}, ${parts[1]} e ${parts[2]}`;
}

/** Converte valor monetário BRL para extenso (pt-BR). Ex.: 1288.8 → "mil duzentos e oitenta e oito reais e oitenta centavos" */
export function valorPorExtenso(value: number): string {
  if (!Number.isFinite(value)) return "zero reais";

  const abs = Math.abs(Math.round(value * 100) / 100);
  const reais = Math.floor(abs);
  const centavos = Math.round((abs - reais) * 100);

  let texto =
    reais === 0
      ? "zero reais"
      : reais === 1
        ? "um real"
        : `${inteiroExtenso(reais)} reais`;

  if (centavos > 0) {
    texto +=
      centavos === 1
        ? " e um centavo"
        : ` e ${inteiroExtenso(centavos)} centavos`;
  }

  return texto;
}
