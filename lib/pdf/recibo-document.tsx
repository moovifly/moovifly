import type { ReactNode } from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { EMPRESA_MOOVIFLY, logoMooviflyPretoSrc } from "@/lib/pdf/empresa";
import type { DadosRecibo, ReciboTrecho } from "@/lib/pdf/recibo-types";

const PRETO = "#1A1A1A";
const CINZA_TEXTO = "#333333";
const CINZA_HEADER = "#D9D9D9";
const CINZA_BORDA = "#000000";
const BRANCO = "#FFFFFF";

const LOGO_SRC = logoMooviflyPretoSrc();

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingLeft: 32,
    paddingRight: 32,
    fontFamily: "Helvetica",
    backgroundColor: BRANCO,
    fontSize: 8,
    color: PRETO,
  },
  logoBlock: {
    alignItems: "center",
    marginBottom: 12,
  },
  logoImg: {
    height: 40,
    objectFit: "contain",
  },
  logoImgSm: {
    height: 28,
    objectFit: "contain",
    marginBottom: 4,
  },
  empresaBlock: {
    marginBottom: 8,
  },
  empresaLinha: {
    fontSize: 8,
    color: CINZA_TEXTO,
    lineHeight: 1.05,
    marginBottom: 0,
  },
  faixaTitulo: {
    backgroundColor: CINZA_HEADER,
    borderWidth: 0.6,
    borderColor: CINZA_BORDA,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 0,
  },
  faixaTituloText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    color: PRETO,
  },
  table: {
    borderLeftWidth: 0.6,
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: CINZA_BORDA,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  cell: {
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: CINZA_BORDA,
    paddingVertical: 3,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  cellLast: {
    borderRightWidth: 0,
  },
  cellNoBottom: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: PRETO,
  },
  value: {
    fontSize: 8,
    color: PRETO,
  },
  headerBg: {
    backgroundColor: CINZA_HEADER,
  },
  declaracao: {
    marginTop: 10,
    marginBottom: 10,
    fontSize: 8,
    color: PRETO,
    lineHeight: 1.4,
    textAlign: "justify",
  },
  declaracaoBold: {
    fontFamily: "Helvetica-Bold",
  },
  produtoHeader: {
    flexDirection: "row",
    backgroundColor: CINZA_HEADER,
    borderWidth: 0.6,
    borderColor: CINZA_BORDA,
  },
  produtoHeaderCell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 0.6,
    borderColor: CINZA_BORDA,
    justifyContent: "center",
  },
  produtoTitulo: {
    fontSize: 9,
    fontFamily: "Helvetica-Oblique",
    color: PRETO,
  },
  produtoHeaderLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: PRETO,
  },
  produtoDetalhe: {
    borderLeftWidth: 0.6,
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: CINZA_BORDA,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 8,
    color: PRETO,
  },
  resumoRow: {
    flexDirection: "row",
    marginTop: 0,
    borderLeftWidth: 0.6,
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: CINZA_BORDA,
  },
  pagamentoTable: {
    marginTop: 10,
    borderWidth: 0.6,
    borderColor: CINZA_BORDA,
  },
  totaisBlock: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: "42%",
  },
  totalLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: PRETO,
  },
  totalValor: {
    fontSize: 8,
    color: PRETO,
    textAlign: "right",
  },
  totalFinal: {
    borderTopWidth: 0.6,
    borderColor: CINZA_BORDA,
    paddingTop: 4,
    marginTop: 2,
  },
  rodape: {
    marginTop: 28,
    alignItems: "center",
  },
  rodapeData: {
    fontSize: 9,
    color: PRETO,
    marginBottom: 10,
  },
  pagina: {
    position: "absolute",
    bottom: 16,
    right: 32,
    fontSize: 8,
    color: PRETO,
  },
});

function Cell({
  children,
  width,
  last,
  noBottom,
  header,
  style,
}: {
  children?: ReactNode;
  width: string | number;
  last?: boolean;
  noBottom?: boolean;
  header?: boolean;
  style?: Style;
}) {
  return (
    <View
      style={[
        styles.cell,
        { width },
        ...(last ? [styles.cellLast] : []),
        ...(noBottom ? [styles.cellNoBottom] : []),
        ...(header ? [styles.headerBg] : []),
        ...(style ? [style] : []),
      ]}
    >
      {children}
    </View>
  );
}

function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <Image
      src={LOGO_SRC}
      style={size === "lg" ? styles.logoImg : styles.logoImgSm}
    />
  );
}

function TrechosTable({ trechos }: { trechos: ReciboTrecho[] }) {
  if (trechos.length === 0) return null;

  return (
    <View style={styles.table}>
      <View style={styles.row} wrap={false}>
        <Cell width="10%" header>
          <Text style={styles.label}>Cia</Text>
        </Cell>
        <Cell width="10%" header>
          <Text style={styles.label}>Voo</Text>
        </Cell>
        <Cell width="10%" header>
          <Text style={styles.label}>Classe</Text>
        </Cell>
        <Cell width="40%" header>
          <Text style={styles.label}>Trecho</Text>
        </Cell>
        <Cell width="30%" header last>
          <Text style={styles.label}>Saída / Chegada</Text>
        </Cell>
      </View>
      {trechos.map((t, i) => (
        <View key={i} style={styles.row} wrap={false}>
          <Cell width="10%" noBottom={i === trechos.length - 1}>
            <Text style={styles.value}>{t.cia}</Text>
          </Cell>
          <Cell width="10%" noBottom={i === trechos.length - 1}>
            <Text style={styles.value}>{t.voo}</Text>
          </Cell>
          <Cell width="10%" noBottom={i === trechos.length - 1}>
            <Text style={styles.value}>{t.classe}</Text>
          </Cell>
          <Cell width="40%" noBottom={i === trechos.length - 1}>
            <Text style={styles.value}>{t.origemLinha}</Text>
            <Text style={styles.value}>{t.destinoLinha}</Text>
          </Cell>
          <Cell width="30%" last noBottom={i === trechos.length - 1}>
            <Text style={styles.value}>{t.saida}</Text>
            <Text style={styles.value}>{t.chegada}</Text>
          </Cell>
        </View>
      ))}
    </View>
  );
}

export function ReciboPdfDocument({ dados }: { dados: DadosRecibo }) {
  const p = dados.pagante;
  const v = dados.valores;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.logoBlock}>
          <Logo size="lg" />
        </View>

        <View style={styles.empresaBlock}>
          <Text style={styles.empresaLinha}>{EMPRESA_MOOVIFLY.endereco}</Text>
          <Text style={styles.empresaLinha}>
            CEP: {EMPRESA_MOOVIFLY.cep} Telefone: {EMPRESA_MOOVIFLY.telefone}
          </Text>
          <Text style={styles.empresaLinha}>
            {EMPRESA_MOOVIFLY.site} - E-mail: {EMPRESA_MOOVIFLY.email}
          </Text>
        </View>

        <View style={styles.faixaTitulo}>
          <Text style={styles.faixaTituloText}>{dados.tituloFaixa}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Cell width="18%">
              <Text style={styles.label}>Pagante:</Text>
            </Cell>
            <Cell width="82%" last>
              <Text style={styles.value}>{p.nome}</Text>
            </Cell>
          </View>
          <View style={styles.row}>
            <Cell width="18%">
              <Text style={styles.label}>Endereço:</Text>
            </Cell>
            <Cell width="32%">
              <Text style={styles.value}>{p.endereco}</Text>
            </Cell>
            <Cell width="12%">
              <Text style={styles.label}>Bairro:</Text>
            </Cell>
            <Cell width="38%" last>
              <Text style={styles.value}>{p.bairro}</Text>
            </Cell>
          </View>
          <View style={styles.row}>
            <Cell width="18%">
              <Text style={styles.label}>Cidade:</Text>
            </Cell>
            <Cell width="32%">
              <Text style={styles.value}>{p.cidade}</Text>
            </Cell>
            <Cell width="8%">
              <Text style={styles.label}>UF:</Text>
            </Cell>
            <Cell width="12%">
              <Text style={styles.value}>{p.uf}</Text>
            </Cell>
            <Cell width="10%">
              <Text style={styles.label}>CEP:</Text>
            </Cell>
            <Cell width="20%" last>
              <Text style={styles.value}>{p.cep}</Text>
            </Cell>
          </View>
          <View style={styles.row}>
            <Cell width="18%" noBottom>
              <Text style={styles.label}>CPF/CNPJ:</Text>
            </Cell>
            <Cell width="24%" noBottom>
              <Text style={styles.value}>{p.cpfCnpj}</Text>
            </Cell>
            <Cell width="12%" noBottom>
              <Text style={styles.label}>IE/RG:</Text>
            </Cell>
            <Cell width="14%" noBottom>
              <Text style={styles.value}>{p.ieRg}</Text>
            </Cell>
            <Cell width="14%" noBottom>
              <Text style={styles.label}>Telefones:</Text>
            </Cell>
            <Cell width="18%" last noBottom>
              <Text style={styles.value}>{p.telefones}</Text>
            </Cell>
          </View>
          <View style={[styles.row, { borderTopWidth: 0.6, borderColor: CINZA_BORDA }]}>
            <Cell width="18%" noBottom>
              <Text style={styles.label}>E-mail:</Text>
            </Cell>
            <Cell width="82%" last noBottom>
              <Text style={styles.value}>{p.email}</Text>
            </Cell>
          </View>
        </View>

        <Text style={styles.declaracao}>
          A {EMPRESA_MOOVIFLY.razaoSocial}, declara que os serviços turísticos
          relacionados neste documento, adquiridos e quitados conforme formas de
          pagamento abaixo, pelo Sr.(a){" "}
          <Text style={styles.declaracaoBold}>{p.nome || "—"}</Text> totalizam a
          importância de{" "}
          <Text style={styles.declaracaoBold}>
            {v.valorNumerico} ({v.valorExtenso})
          </Text>{" "}
          que, considerada a posse transitória de tais valores e retenção de
          valor pelos serviços de intermediação, serão devidamente repassados
          por esta agência de viagens a cada um dos fornecedores contratados.
        </Text>

        <View style={styles.produtoHeader} wrap={false}>
          <View style={[styles.produtoHeaderCell, { width: "40%" }]}>
            <Text style={styles.produtoTitulo}>{dados.produtoTitulo}</Text>
          </View>
          <View style={[styles.produtoHeaderCell, { width: "30%" }]}>
            <Text style={styles.produtoHeaderLabel}>Cia Aérea</Text>
            <Text style={styles.value}>{dados.companhia}</Text>
          </View>
          <View
            style={[
              styles.produtoHeaderCell,
              { width: "30%", borderRightWidth: 0 },
            ]}
          >
            <Text style={styles.produtoHeaderLabel}>Localizador</Text>
            <Text style={styles.value}>{dados.localizador}</Text>
          </View>
        </View>

        {dados.produtoDetalhe ? (
          <Text style={styles.produtoDetalhe}>{dados.produtoDetalhe}</Text>
        ) : null}

        <TrechosTable trechos={dados.trechos} />

        <View style={styles.table}>
          <View style={styles.row} wrap={false}>
            <Cell width="34%" header>
              <Text style={styles.label}>Passageiro</Text>
            </Cell>
            <Cell width="18%" header>
              <Text style={styles.label}>Nº Bilhete</Text>
            </Cell>
            <Cell width="16%" header>
              <Text style={styles.label}>Centro de custo</Text>
            </Cell>
            <Cell width="10%" header>
              <Text style={styles.label}>Valor</Text>
            </Cell>
            <Cell width="10%" header>
              <Text style={styles.label}>Taxas</Text>
            </Cell>
            <Cell width="12%" header last>
              <Text style={styles.label}>Total</Text>
            </Cell>
          </View>
          {dados.passageiros.map((pax, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <Cell width="34%" noBottom={i === dados.passageiros.length - 1}>
                <Text style={styles.value}>{pax.nome}</Text>
              </Cell>
              <Cell width="18%" noBottom={i === dados.passageiros.length - 1}>
                <Text style={styles.value}>{pax.bilhete}</Text>
              </Cell>
              <Cell width="16%" noBottom={i === dados.passageiros.length - 1}>
                <Text style={styles.value}>{pax.centroCusto}</Text>
              </Cell>
              <Cell width="10%" noBottom={i === dados.passageiros.length - 1}>
                <Text style={styles.value}>
                  {i === 0 ? v.produtos : ""}
                </Text>
              </Cell>
              <Cell width="10%" noBottom={i === dados.passageiros.length - 1}>
                <Text style={styles.value}>
                  {i === 0 ? v.taxasRodape : ""}
                </Text>
              </Cell>
              <Cell
                width="12%"
                last
                noBottom={i === dados.passageiros.length - 1}
              >
                <Text style={[styles.value, { fontFamily: "Helvetica-Bold" }]}>
                  {i === 0 ? `R$${v.total}` : ""}
                </Text>
              </Cell>
            </View>
          ))}
        </View>

        <View style={styles.resumoRow} wrap={false}>
          <Cell width="25%" header noBottom>
            <Text style={styles.label}>Valor</Text>
            <Text style={styles.value}>{v.produtos}</Text>
          </Cell>
          <Cell width="25%" header noBottom>
            <Text style={styles.label}>Taxa DU</Text>
            <Text style={styles.value}>{v.taxaDu}</Text>
          </Cell>
          <Cell width="25%" header noBottom>
            <Text style={styles.label}>Taxas</Text>
            <Text style={styles.value}>{v.taxas}</Text>
          </Cell>
          <Cell width="25%" header last noBottom>
            <Text style={styles.label}>Total</Text>
            <Text style={[styles.value, { fontFamily: "Helvetica-Bold" }]}>
              R${v.total}
            </Text>
          </Cell>
        </View>

        <View style={styles.pagamentoTable} wrap={false}>
          <View style={styles.row}>
            <Cell width="50%" header noBottom>
              <Text style={styles.label}>Pagamento para a Agência</Text>
            </Cell>
            <Cell width="25%" header noBottom>
              <Text style={styles.label}>Data Pagamento</Text>
            </Cell>
            <Cell width="25%" header last noBottom>
              <Text style={styles.label}>Valor (R$)</Text>
            </Cell>
          </View>
          <View style={styles.row}>
            <Cell width="50%" noBottom>
              <Text style={styles.value}>{dados.formaPagamento}</Text>
            </Cell>
            <Cell width="25%" noBottom>
              <Text style={styles.value}>{dados.dataPagamento}</Text>
            </Cell>
            <Cell width="25%" last noBottom>
              <Text style={styles.value}>R${v.total}</Text>
            </Cell>
          </View>
        </View>

        <View style={styles.totaisBlock} wrap={false}>
          <View style={styles.totalLinha}>
            <Text style={styles.totalLabel}>Produtos:</Text>
            <Text style={styles.totalValor}>{v.produtos}</Text>
          </View>
          <View style={styles.totalLinha}>
            <Text style={styles.totalLabel}>Abatimentos:</Text>
            <Text style={styles.totalValor}>{v.abatimentos}</Text>
          </View>
          <View style={styles.totalLinha}>
            <Text style={styles.totalLabel}>Taxas:</Text>
            <Text style={styles.totalValor}>{v.taxasRodape}</Text>
          </View>
          <View style={[styles.totalLinha, styles.totalFinal]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={[styles.totalValor, { fontFamily: "Helvetica-Bold" }]}>
              {v.total}
            </Text>
          </View>
        </View>

        <View style={styles.rodape}>
          <Logo size="sm" />
          <Text style={styles.rodapeData}>{dados.dataEmissaoExtenso}</Text>
        </View>

        <Text style={styles.pagina} fixed>
          Página 1 de 1
        </Text>
      </Page>
    </Document>
  );
}
