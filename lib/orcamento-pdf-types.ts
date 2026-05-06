/** Entrada para geração do PDF (modelo do backoffice). */

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
  tipo_viagem?: "nacional" | "internacional";
  adultos: number;
  criancas: number;
  bebes: number;
  com_bagagem: boolean;
  bagagens?: { bolsa?: number; mao?: number; grande?: number } | null;
  voos: VooPdf[];
  valor_total: number | string;
  forma_pagamento: string | null;
  observacoes?: string | null;
};
