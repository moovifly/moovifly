import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { DadosOrcamento, VooOrcamento } from "@/lib/pdf/orcamento-types";
import { textoLinhaPassageiros } from "@/lib/pdf/map-orcamento-input";

const PRETO = "#1A1A1A";
const CINZA_TEXTO = "#444444";
const CINZA_CLARO = "#F5F5F5";
const CINZA_BORDA = "#DDDDDD";
const BRANCO = "#FFFFFF";
const CINZA_RODAPE = "#999999";

const COL_WIDTHS = ["20%", "6%", "12%", "12%", "18%", "24%", "8%"] as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: "20mm",
    paddingBottom: "20mm",
    paddingLeft: "18mm",
    paddingRight: "18mm",
    fontFamily: "Helvetica",
    backgroundColor: BRANCO,
    fontSize: 9,
    color: PRETO,
  },
  headerLogoBlock: {
    alignItems: "center",
    marginBottom: "4mm",
  },
  agenciaNome: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: PRETO,
    textAlign: "center",
    textTransform: "uppercase",
  },
  agenciaSub: {
    fontSize: 6,
    color: CINZA_TEXTO,
    textAlign: "center",
    marginTop: 2,
  },
  logoImg: {
    height: 36,
    objectFit: "contain",
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: "4mm",
  },
  infoLeft: {
    width: "60%",
    fontSize: 9,
    color: CINZA_TEXTO,
    lineHeight: 1.45,
  },
  infoRight: {
    width: "40%",
    fontSize: 9,
    color: CINZA_TEXTO,
    textAlign: "right",
    lineHeight: 1.45,
  },
  tituloOrcamento: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: PRETO,
    textAlign: "center",
    marginBottom: "6mm",
  },
  linhaInfo: {
    fontSize: 9,
    color: CINZA_TEXTO,
    lineHeight: 1.45,
    marginBottom: 4,
  },
  table: {
    borderWidth: 0.5,
    borderColor: CINZA_BORDA,
    marginBottom: "6mm",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  cell: {
    padding: 6,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: CINZA_BORDA,
    justifyContent: "center",
  },
  cellLast: {
    borderRightWidth: 0,
  },
  headerCell: {
    backgroundColor: PRETO,
    borderColor: CINZA_BORDA,
  },
  headerCellText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRANCO,
  },
  cellText: {
    fontSize: 9,
    color: PRETO,
    fontFamily: "Helvetica",
  },
  rowZebra: {
    backgroundColor: CINZA_CLARO,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: "8mm",
  },
  badge: {
    backgroundColor: PRETO,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    minWidth: 100,
    alignItems: "flex-end",
  },
  badgeText: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: BRANCO,
  },
  pgtoTitulo: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: PRETO,
    marginBottom: 2,
  },
  pgtoLinha: {
    fontSize: 9,
    color: CINZA_TEXTO,
    marginBottom: 2,
  },
  obsText: {
    fontSize: 9,
    color: CINZA_TEXTO,
    marginTop: "4mm",
    marginBottom: "4mm",
    lineHeight: 1.4,
  },
  sepLine: {
    borderTopWidth: 0.5,
    borderColor: CINZA_BORDA,
    marginTop: "8mm",
    marginBottom: "3mm",
    width: "100%",
  },
  rodape: {
    fontSize: 7.5,
    color: CINZA_RODAPE,
    textAlign: "center",
    lineHeight: 1.35,
  },
});

function cellWidth(index: number): string {
  return COL_WIDTHS[index] ?? "10%";
}

function codigoCidade(codigo: string, cidade: string): string {
  const c = (cidade ?? "").trim();
  const co = (codigo ?? "").trim();
  if (!co && !c) return "—";
  if (!c) return co;
  if (!co) return c;
  return `${co} - ${c}`;
}

function celulaSaidaChegada(v: VooOrcamento, tipo: "saida" | "chegada"): string {
  if (tipo === "saida") {
    const d = v.dataSaida;
    const h = v.horaSaida;
    if (d === "—" && h === "—") return "—";
    if (d === "—") return h;
    if (h === "—") return d;
    return `${d} ${h}`;
  }
  const d = v.dataChegada;
  const h = v.horaChegada;
  if (d === "—" && h === "—") return "—";
  if (d === "—") return h;
  if (h === "—") return d;
  return `${d} ${h}`;
}

export function OrcamentoPdfDocument({ dados }: { dados: DadosOrcamento }) {
  const nota = dados.notaRodape ?? "";

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerLogoBlock}>
          {dados.agencia.logoPath ? (
            <Image src={dados.agencia.logoPath} style={styles.logoImg} />
          ) : (
            <>
              <Text style={styles.agenciaNome}>{dados.agencia.nome}</Text>
              <Text style={styles.agenciaSub}>agência de turismo</Text>
            </>
          )}
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Text>
              {dados.agencia.email}
              {"\n"}
              {dados.agencia.site}
              {"\n"}
              {dados.agencia.telefone}
            </Text>
          </View>
          <View style={styles.infoRight}>
            <Text>{dados.dataOrcamento}</Text>
          </View>
        </View>

        <Text style={styles.tituloOrcamento}>Orçamento</Text>

        <Text style={styles.linhaInfo}>{textoLinhaPassageiros(dados.passageiros)}</Text>
        <Text style={styles.linhaInfo}>{dados.linhaBagagem}</Text>

        <View style={styles.table}>
          <View style={styles.tableRow} wrap={false}>
            {(["Cia", "Voo", "Saída", "Chegada", "Origem", "Destino", "Dur."] as const).map(
              (label, i) => (
                <View
                  key={label}
                  style={[
                    styles.cell,
                    { width: cellWidth(i) },
                    styles.headerCell,
                    ...(i === COL_WIDTHS.length - 1 ? [styles.cellLast] : []),
                  ]}
                >
                  <Text style={styles.headerCellText}>{label}</Text>
                </View>
              ),
            )}
          </View>

          {dados.voos.map((v, rowIdx) => (
            <View
              key={`${v.numero}-${rowIdx}`}
              style={[styles.tableRow, ...(rowIdx % 2 === 1 ? [styles.rowZebra] : [])]}
              wrap={false}
            >
              <View style={[styles.cell, { width: cellWidth(0) }]}>
                <Text style={styles.cellText}>{v.cia}</Text>
              </View>
              <View style={[styles.cell, { width: cellWidth(1) }]}>
                <Text style={styles.cellText}>{v.numero}</Text>
              </View>
              <View style={[styles.cell, { width: cellWidth(2) }]}>
                <Text style={styles.cellText}>{celulaSaidaChegada(v, "saida")}</Text>
              </View>
              <View style={[styles.cell, { width: cellWidth(3) }]}>
                <Text style={styles.cellText}>{celulaSaidaChegada(v, "chegada")}</Text>
              </View>
              <View style={[styles.cell, { width: cellWidth(4) }]}>
                <Text style={styles.cellText}>{codigoCidade(v.origemCodigo, v.origemCidade)}</Text>
              </View>
              <View style={[styles.cell, { width: cellWidth(5) }]}>
                <Text style={styles.cellText}>
                  {codigoCidade(v.destinoCodigo, v.destinoCidade)}
                </Text>
              </View>
              <View style={[styles.cell, { width: cellWidth(6) }, styles.cellLast]}>
                <Text style={styles.cellText}>{v.duracao}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{dados.valorTotal}</Text>
          </View>
        </View>

        <Text style={styles.pgtoTitulo}>Formas de Pagamento:</Text>
        {dados.formasPagamento.map((linha, i) => (
          <Text key={i} style={styles.pgtoLinha}>
            {linha}
          </Text>
        ))}

        {dados.observacoes ? (
          <Text style={styles.obsText}>{dados.observacoes}</Text>
        ) : null}

        <View style={styles.sepLine} />

        <Text style={styles.rodape}>{nota}</Text>
      </Page>
    </Document>
  );
}
