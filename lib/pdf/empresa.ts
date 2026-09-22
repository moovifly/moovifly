import fs from "fs";
import path from "path";

/** Dados fixos da MooviFly usados em PDFs (recibo, etc.). */
export const EMPRESA_MOOVIFLY = {
  nome: "moovifly",
  subtitulo: "agência de turismo",
  razaoSocial: "MOOVIFLY AGÊNCIA DE VIAGENS",
  endereco: "R. Aluísio Neiva, 1054 - Centro São Gonçalo - RJ",
  cep: "24445-400",
  telefone: "(11) 93476-2251",
  site: "www.moovifly.com",
  email: "contato@moovifly.com",
  cidadeEmissao: "São Paulo",
} as const;

/** Data URI do logo preto — confiável no @react-pdf (Node / API Route). */
export function logoMooviflyPretoSrc(): string {
  const filePath = path.join(
    process.cwd(),
    "public",
    "assets",
    "images",
    "moovifly_logo_preto.png",
  );
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}
