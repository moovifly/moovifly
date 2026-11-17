import { extractDateOnly, parseDateOnlyToLocal } from "@/lib/date-only";

export function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? Number(value) : value ?? 0;
  if (Number.isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num as number);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  if (typeof date === "string") {
    const dateOnly = extractDateOnly(date);
    if (dateOnly) {
      const d = parseDateOnlyToLocal(dateOnly);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    }
  }
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
}

export function formatPercent(value: number | string | null | undefined, fractionDigits = 2): string {
  const num = typeof value === "string" ? Number(value) : value ?? 0;
  if (Number.isNaN(num)) return "0%";
  return `${(num as number).toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
}

export function formatCpfCnpj(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value;
}

export type TipoDocumento = "cpf" | "cnpj" | "passaporte";

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  passaporte: "Passaporte",
};

export function normalizeTipoDocumento(value: string | null | undefined): TipoDocumento {
  if (value === "cnpj" || value === "passaporte" || value === "cpf") return value;
  return "cpf";
}

export function documentoPlaceholder(tipo: TipoDocumento): string {
  if (tipo === "cnpj") return "00.000.000/0000-00";
  if (tipo === "passaporte") return "Ex.: AB123456";
  return "000.000.000-00";
}

function maskCpfDigits(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskCnpj(value: string): string {
  const d = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Máscara enquanto o usuário digita, conforme o tipo escolhido. */
export function formatDocumentoInput(value: string, tipo: TipoDocumento): string {
  if (tipo === "passaporte") {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  }
  if (tipo === "cnpj") return maskCnpj(value);
  return maskCpfDigits(value.replace(/\D/g, ""));
}

export function documentoParaSalvar(value: string, tipo: TipoDocumento): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (tipo === "cpf") {
    const digits = trimmed.replace(/\D/g, "");
    return digits || null;
  }
  const doc = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return doc || null;
}

/** Retorna mensagem de erro quando o documento preenchido está incompleto. */
export function validarDocumento(value: string, tipo: TipoDocumento): string | null {
  const salvo = documentoParaSalvar(value, tipo);
  if (!salvo) return null;
  if (tipo === "cpf" && salvo.length !== 11) return "CPF deve ter 11 dígitos.";
  if (tipo === "cnpj" && !/^[A-Z0-9]{14}$/.test(salvo)) return "CNPJ deve ter 14 caracteres.";
  if (tipo === "passaporte" && salvo.length < 5) return "Informe o número completo do passaporte.";
  return null;
}

export function formatDocumento(value: string | null | undefined, tipo?: string | null): string {
  if (!value?.trim()) return "";
  const kind = normalizeTipoDocumento(tipo);
  if (kind === "passaporte") return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (kind === "cnpj") return maskCnpj(value);
  return formatCpfCnpj(value);
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
