"""
Gerador de Orçamento de Voos - Moovifly
Referência de implementação baseada no modelo ORC-202604-0001

Dependências:
    pip install reportlab pillow

Uso:
    python gerar_orcamento.py
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate
import os

# ─────────────────────────────────────────
# PALETA DE CORES
# ─────────────────────────────────────────
PRETO        = colors.HexColor("#1A1A1A")
CINZA_TEXTO  = colors.HexColor("#444444")
CINZA_CLARO  = colors.HexColor("#F5F5F5")
CINZA_BORDA  = colors.HexColor("#DDDDDD")
VERDE_BADGE  = colors.HexColor("#1A1A1A")   # badge de preço (fundo escuro)
BRANCO       = colors.white

# ─────────────────────────────────────────
# ESTILOS DE TEXTO
# ─────────────────────────────────────────
estilo_titulo = ParagraphStyle(
    "titulo",
    fontName="Helvetica-Bold",
    fontSize=28,
    textColor=PRETO,
    alignment=TA_CENTER,
    spaceAfter=12,
)

estilo_subtitulo = ParagraphStyle(
    "subtitulo",
    fontName="Helvetica",
    fontSize=10,
    textColor=CINZA_TEXTO,
    alignment=TA_LEFT,
    spaceAfter=4,
)

estilo_info_esq = ParagraphStyle(
    "info_esq",
    fontName="Helvetica",
    fontSize=9,
    textColor=CINZA_TEXTO,
    alignment=TA_LEFT,
    leading=14,
)

estilo_info_dir = ParagraphStyle(
    "info_dir",
    fontName="Helvetica",
    fontSize=9,
    textColor=CINZA_TEXTO,
    alignment=TA_RIGHT,
    leading=14,
)

estilo_bagagem = ParagraphStyle(
    "bagagem",
    fontName="Helvetica",
    fontSize=9,
    textColor=CINZA_TEXTO,
    alignment=TA_LEFT,
    leading=13,
    spaceAfter=6,
)

estilo_tabela_header = ParagraphStyle(
    "tab_header",
    fontName="Helvetica-Bold",
    fontSize=9,
    textColor=BRANCO,
)

estilo_tabela_cel = ParagraphStyle(
    "tab_cel",
    fontName="Helvetica",
    fontSize=9,
    textColor=PRETO,
)

estilo_preco = ParagraphStyle(
    "preco",
    fontName="Helvetica-Bold",
    fontSize=13,
    textColor=BRANCO,
    alignment=TA_RIGHT,
)

estilo_pagamento_titulo = ParagraphStyle(
    "pgto_titulo",
    fontName="Helvetica-Bold",
    fontSize=9,
    textColor=PRETO,
    spaceAfter=2,
)

estilo_pagamento_corpo = ParagraphStyle(
    "pgto_corpo",
    fontName="Helvetica",
    fontSize=9,
    textColor=CINZA_TEXTO,
)

estilo_rodape = ParagraphStyle(
    "rodape",
    fontName="Helvetica",
    fontSize=7.5,
    textColor=colors.HexColor("#999999"),
    alignment=TA_CENTER,
)


# ─────────────────────────────────────────
# CLASSE PRINCIPAL DO DOCUMENTO
# ─────────────────────────────────────────
class OrcamentoPDF:
    """
    Gera um orçamento de passagem aérea no layout Moovifly.

    Parâmetros do construtor
    ─────────────────────────
    dados : dict  — todas as informações variáveis do orçamento.

    Estrutura esperada de `dados`:
    {
        "agencia": {
            "logo_path": "logo.png",      # caminho para o logo (opcional)
            "nome": "Moovifly",
            "email": "contato@moovifly.com",
            "site": "www.moovifly.com",
            "telefone": "(11) 93476-2251",
        },
        "data_orcamento": "29 de Abril, 2026",
        "passageiros": {
            "adultos": 1,
            "criancas": 0,
            "bebes": 0,
        },
        "bagagem": {
            "despachada": "23kg",
            "mao": True,
            "bolsa": True,
        },
        "voos": [
            {
                "cia": "GOL Linhas Aéreas",
                "numero": "8186",
                "data_saida": "01/05/26",
                "hora_saida": "12:00h",
                "data_chegada": "01/05/26",
                "hora_chegada": "13:30h",
                "origem_codigo": "CGH",
                "origem_cidade": "São Paulo",
                "destino_codigo": "SDU",
                "destino_cidade": "Rio de Janeiro",
                "duracao": "01:30",
            }
        ],
        "valor_total": "R$ 1.000,00",
        "formas_pagamento": ["À vista via Pix"],
        "nota_rodape": "*Os valores informados poderão ser eventualmente alterados pela companhia aérea.",
    }
    """

    # Margens do documento (em mm)
    MARGEM_ESQ  = 18 * mm
    MARGEM_DIR  = 18 * mm
    MARGEM_SUP  = 20 * mm
    MARGEM_INF  = 20 * mm

    def __init__(self, dados: dict, caminho_saida: str = "orcamento.pdf"):
        self.dados = dados
        self.caminho_saida = caminho_saida

    def gerar(self):
        doc = SimpleDocTemplate(
            self.caminho_saida,
            pagesize=A4,
            leftMargin=self.MARGEM_ESQ,
            rightMargin=self.MARGEM_DIR,
            topMargin=self.MARGEM_SUP,
            bottomMargin=self.MARGEM_INF,
        )

        story = []
        story += self._bloco_cabecalho()
        story += self._bloco_titulo()
        story += self._bloco_info_passageiros()
        story += self._bloco_tabela_voos()
        story += self._bloco_preco()
        story += self._bloco_pagamento()
        story.append(Spacer(1, 8 * mm))
        story += self._bloco_rodape()

        doc.build(story)
        print(f"PDF gerado: {self.caminho_saida}")
        return self.caminho_saida

    # ─── BLOCOS ───────────────────────────────────────────

    def _bloco_cabecalho(self):
        """Logo (esquerda) + Data (direita)"""
        ag = self.dados["agencia"]

        col_logo = Paragraph(
            f"<b>{ag['nome'].upper()}</b><br/>"
            f"<font size=6>agência de turismo</font>",
            ParagraphStyle("logo_text", fontName="Helvetica-Bold",
                           fontSize=18, textColor=PRETO, leading=20)
        )

        col_contato = Paragraph(
            f"{ag['email']}<br/>{ag['site']}<br/>{ag['telefone']}",
            estilo_info_esq
        )

        col_data = Paragraph(self.dados["data_orcamento"], estilo_info_dir)

        largura_util = A4[0] - self.MARGEM_ESQ - self.MARGEM_DIR

        # Linha 1: logo centralizado
        t_logo = Table([[col_logo]], colWidths=[largura_util])
        t_logo.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))

        # Linha 2: contato (esq) + data (dir)
        t_info = Table(
            [[col_contato, col_data]],
            colWidths=[largura_util * 0.6, largura_util * 0.4],
        )
        t_info.setStyle(TableStyle([
            ("ALIGN", (0, 0), (0, 0), "LEFT"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))

        return [t_logo, Spacer(1, 4 * mm), t_info, Spacer(1, 4 * mm)]

    def _bloco_titulo(self):
        return [
            Paragraph("Orçamento", estilo_titulo),
            Spacer(1, 6 * mm),
        ]

    def _bloco_info_passageiros(self):
        p = self.dados["passageiros"]
        b = self.dados["bagagem"]

        partes_adulto = []
        if p.get("adultos", 0):
            partes_adulto.append(f"{p['adultos']} adulto{'s' if p['adultos'] > 1 else ''}")
        if p.get("criancas", 0):
            partes_adulto.append(f"{p['criancas']} criança{'s' if p['criancas'] > 1 else ''}")
        if p.get("bebes", 0):
            partes_adulto.append(f"{p['bebes']} bebê{'s' if p['bebes'] > 1 else ''}")

        partes_bag = []
        if b.get("despachada"):
            partes_bag.append(f"1 bagagem de até {b['despachada']}")
        if b.get("mao"):
            partes_bag.append("1 bagagem de mão")
        if b.get("bolsa"):
            partes_bag.append("1 bolsa ou mochila pessoal")

        bag_texto = " + ".join(partes_bag)
        if b.get("mao") or b.get("bolsa"):
            bag_texto += " (por passageiro)"

        return [
            Paragraph(", ".join(partes_adulto), estilo_bagagem),
            Paragraph(bag_texto, estilo_bagagem),
            Spacer(1, 4 * mm),
        ]

    def _bloco_tabela_voos(self):
        largura_util = A4[0] - self.MARGEM_ESQ - self.MARGEM_DIR

        # Proporções das colunas (total = 1.0)
        proporcoes = [0.20, 0.06, 0.12, 0.12, 0.18, 0.24, 0.08]
        col_widths = [largura_util * p for p in proporcoes]

        cabecalhos = ["Cia", "Voo", "Saída", "Chegada", "Origem", "Destino", "Dur."]
        header_row = [
            Paragraph(h, ParagraphStyle(
                "th", fontName="Helvetica-Bold", fontSize=9, textColor=BRANCO
            ))
            for h in cabecalhos
        ]

        linhas = [header_row]
        for v in self.dados["voos"]:
            linhas.append([
                Paragraph(v["cia"],                                          estilo_tabela_cel),
                Paragraph(v["numero"],                                       estilo_tabela_cel),
                Paragraph(f"{v['data_saida']} {v['hora_saida']}",            estilo_tabela_cel),
                Paragraph(f"{v['data_chegada']} {v['hora_chegada']}",        estilo_tabela_cel),
                Paragraph(f"{v['origem_codigo']} - {v['origem_cidade']}",    estilo_tabela_cel),
                Paragraph(f"{v['destino_codigo']} - {v['destino_cidade']}",  estilo_tabela_cel),
                Paragraph(v["duracao"],                                      estilo_tabela_cel),
            ])

        tabela = Table(linhas, colWidths=col_widths, repeatRows=1)
        tabela.setStyle(TableStyle([
            # Header
            ("BACKGROUND",    (0, 0), (-1, 0),  PRETO),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  BRANCO),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, 0),  9),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [BRANCO, CINZA_CLARO]),
            # Padding
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            # Bordas
            ("BOX",           (0, 0), (-1, -1), 0.5, CINZA_BORDA),
            ("INNERGRID",     (0, 0), (-1, -1), 0.5, CINZA_BORDA),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]))

        return [tabela, Spacer(1, 6 * mm)]

    def _bloco_preco(self):
        """Badge de preço alinhado à direita."""
        largura_util = A4[0] - self.MARGEM_ESQ - self.MARGEM_DIR
        largura_badge = 100

        preco_par = Paragraph(self.dados["valor_total"], estilo_preco)

        t = Table(
            [["", preco_par]],
            colWidths=[largura_util - largura_badge, largura_badge],
        )
        t.setStyle(TableStyle([
            ("BACKGROUND",    (1, 0), (1, 0), VERDE_BADGE),
            ("TEXTCOLOR",     (1, 0), (1, 0), BRANCO),
            ("ALIGN",         (1, 0), (1, 0), "RIGHT"),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (1, 0), (1, 0), 10),
            ("RIGHTPADDING",  (1, 0), (1, 0), 10),
            ("ROUNDEDCORNERS",(1, 0), (1, 0), 4),
        ]))

        return [t, Spacer(1, 8 * mm)]

    def _bloco_pagamento(self):
        formas = self.dados.get("formas_pagamento", [])
        elementos = [Paragraph("Formas de Pagamento:", estilo_pagamento_titulo)]
        for forma in formas:
            elementos.append(Paragraph(forma, estilo_pagamento_corpo))
        elementos.append(Spacer(1, 4 * mm))
        return elementos

    def _bloco_rodape(self):
        nota = self.dados.get("nota_rodape", "")
        return [
            HRFlowable(width="100%", thickness=0.5, color=CINZA_BORDA),
            Spacer(1, 3 * mm),
            Paragraph(nota, estilo_rodape),
        ]


# ─────────────────────────────────────────
# EXEMPLO DE USO
# ─────────────────────────────────────────
if __name__ == "__main__":
    dados_exemplo = {
        "agencia": {
            "nome": "Moovifly",
            "email": "contato@moovifly.com",
            "site": "www.moovifly.com",
            "telefone": "(11) 93476-2251",
        },
        "data_orcamento": "29 de Abril, 2026",
        "passageiros": {
            "adultos": 1,
            "criancas": 0,
            "bebes": 0,
        },
        "bagagem": {
            "despachada": "23kg",
            "mao": True,
            "bolsa": True,
        },
        "voos": [
            {
                "cia": "GOL Linhas Aéreas",
                "numero": "8186",
                "data_saida": "01/05/26",
                "hora_saida": "12:00h",
                "data_chegada": "01/05/26",
                "hora_chegada": "13:30h",
                "origem_codigo": "CGH",
                "origem_cidade": "São Paulo",
                "destino_codigo": "SDU",
                "destino_cidade": "Rio de Janeiro",
                "duracao": "01:30",
            }
        ],
        "valor_total": "R$ 1.000,00",
        "formas_pagamento": ["À vista via Pix"],
        "nota_rodape": (
            "*Os valores informados poderão ser eventualmente "
            "alterados pela companhia aérea."
        ),
    }

    pdf = OrcamentoPDF(dados_exemplo, "orcamento_referencia.pdf")
    pdf.gerar()
