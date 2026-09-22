export type ReciboPagante = {
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  cpfCnpj: string;
  ieRg: string;
  telefones: string;
  email: string;
};

export type ReciboTrecho = {
  cia: string;
  voo: string;
  classe: string;
  origemLinha: string;
  destinoLinha: string;
  saida: string;
  chegada: string;
};

export type ReciboPassageiroLinha = {
  nome: string;
  bilhete: string;
  centroCusto: string;
};

export type ReciboValores = {
  produtos: string;
  abatimentos: string;
  taxaDu: string;
  taxas: string;
  taxasRodape: string;
  total: string;
  valorNumerico: string;
  valorExtenso: string;
};

export type DadosRecibo = {
  tituloFaixa: string;
  pagante: ReciboPagante;
  produtoTitulo: string;
  companhia: string;
  localizador: string;
  /** Detalhe livre para seguro/serviço (ex.: destino · datas). */
  produtoDetalhe?: string;
  trechos: ReciboTrecho[];
  passageiros: ReciboPassageiroLinha[];
  valores: ReciboValores;
  formaPagamento: string;
  dataPagamento: string;
  dataEmissaoExtenso: string;
};
