/** Contrato de dados do SPEC_PDF_ORCAMENTO.md */

export interface AgenciaOrcamento {
  nome: string;
  email: string;
  site: string;
  telefone: string;
  logoPath?: string;
}

export interface PassageirosOrcamento {
  adultos: number;
  criancas?: number;
  bebes?: number;
}

export interface BagagemOrcamento {
  despachada?: string;
  mao?: boolean;
  bolsa?: boolean;
}

export interface VooOrcamento {
  cia: string;
  numero: string;
  dataSaida: string;
  horaSaida: string;
  dataChegada: string;
  horaChegada: string;
  origemCodigo: string;
  origemCidade: string;
  destinoCodigo: string;
  destinoCidade: string;
  duracao: string;
}

export interface DadosOrcamento {
  agencia: AgenciaOrcamento;
  dataOrcamento: string;
  passageiros: PassageirosOrcamento;
  bagagem: BagagemOrcamento;
  /** Texto final da linha “Franquia de bagagem” (SPEC). */
  linhaBagagem: string;
  voos: VooOrcamento[];
  valorTotal: string;
  formasPagamento: string[];
  notaRodape?: string;
  /** Observações livres do cadastro (opcional). */
  observacoes?: string;
}
