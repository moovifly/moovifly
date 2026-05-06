# SPEC — Template PDF de Orçamento de Passagem Aérea
> Referência: `ORC-202604-0001` (Moovifly Agência de Turismo)

## Objetivo
Implementar uma função/serviço que gere um PDF de orçamento de passagem aérea
a partir de um objeto de dados estruturado. O PDF deve seguir fielmente o layout
descrito abaixo.

---

## Stack Recomendada (Next.js / Node)

| Biblioteca | Finalidade |
|---|---|
| `@react-pdf/renderer` | Geração de PDF no servidor (SSR/API Route) |
| `puppeteer` + HTML | Alternativa: renderizar HTML e salvar como PDF |
| `pdfkit` | Alternativa baixo nível para Node puro |

> **Preferência:** use `@react-pdf/renderer` se o projeto já usa React.
> O arquivo `gerar_orcamento.py` na mesma pasta é a **implementação de referência**
> em Python/ReportLab — use-o para validar o resultado visual.

---

## Estrutura do Documento

```
┌────────────────────────────────────────┐
│  [LOGO / NOME AGÊNCIA]  centralized    │
├───────────────────┬────────────────────┤
│  contato          │         data       │
│  site             │                    │
│  telefone         │                    │
├────────────────────────────────────────┤
│              Orçamento                 │  ← título H1, bold, 28px, centrado
├────────────────────────────────────────┤
│  Nº passageiros                        │
│  Franquia de bagagem                   │
├────────────────────────────────────────┤
│ TABELA DE VOOS (header escuro)         │
│  Cia | Voo | Saída | Chegada | Origem | Destino | Dur. │
│  ...dados...                           │
├────────────────────────────────────────┤
│                        [R$ X.XXX,XX]   │  ← badge fundo #1A1A1A, texto branco
├────────────────────────────────────────┤
│  Formas de Pagamento: (bold)           │
│  À vista via Pix                       │
├────────────────────────────────────────┤
│  ─────────────────────────────────     │  ← linha separadora
│  *Nota de rodapé (tamanho 7.5px, cinza)│
└────────────────────────────────────────┘
```

---

## Especificação Visual

### Página
- Tamanho: **A4** (210 × 297 mm)
- Margens: `18mm` esquerda/direita · `20mm` superior/inferior
- Fundo: branco puro `#FFFFFF`
- Fonte base: `Helvetica` / `Arial` (sem serifa)

### Paleta de Cores
| Token | Hex | Uso |
|---|---|---|
| `preto` | `#1A1A1A` | Títulos, header da tabela, badge de preço |
| `cinza-texto` | `#444444` | Corpo de texto secundário |
| `cinza-claro` | `#F5F5F5` | Linhas alternadas da tabela (zebra) |
| `cinza-borda` | `#DDDDDD` | Bordas da tabela e linha separadora do rodapé |
| `branco` | `#FFFFFF` | Fundo, texto sobre fundo escuro |
| `cinza-rodape` | `#999999` | Nota de rodapé |

---

## Blocos de Conteúdo

### 1. Cabeçalho (`header`)
- **Logo/Nome da agência** — centrado, bold, 18px.
  - Subtexto "agência de turismo" abaixo, 6px, normal.
  - Se houver `logo_path`, renderizar imagem; caso contrário, usar texto.
- Abaixo do logo, duas colunas (60% / 40%):
  - **Esquerda:** email · site · telefone — 9px, `#444444`, alinhamento esquerdo.
  - **Direita:** data do orçamento — 9px, `#444444`, alinhamento direito.

### 2. Título
- Texto: `"Orçamento"` — 28px, bold, preto, **centralizado**.
- Espaçamento inferior: `6mm`.

### 3. Informações de Passageiros e Bagagem
- Linha 1: quantidade de passageiros (ex: `"1 adulto"`)
- Linha 2: franquia de bagagem (ex: `"1 bagagem de até 23kg + 1 bagagem de mão + 1 bolsa ou mochila pessoal (por passageiro)"`)
- Fonte: 9px, `#444444`.

### 4. Tabela de Voos
**Colunas e larguras proporcionais (soma = 100%):**

| Coluna | Chave | % |
|---|---|---|
| Cia | `cia` | 20% |
| Voo | `numero` | 6% |
| Saída | `data_saida` + `hora_saida` | 12% |
| Chegada | `data_chegada` + `hora_chegada` | 12% |
| Origem | `origem_codigo` + `" - "` + `origem_cidade` | 18% |
| Destino | `destino_codigo` + `" - "` + `destino_cidade` | 24% |
| Dur. | `duracao` | 8% |

**Estilo da tabela:**
- Header: fundo `#1A1A1A`, texto branco, bold 9px.
- Linhas de dados: alternância branco / `#F5F5F5` (zebra striping).
- Padding células: `6px` todos os lados.
- Bordas: `0.5px solid #DDDDDD` em todas as células.
- Texto: 9px, `#1A1A1A`.

### 5. Badge de Preço Total
- Alinhado à **direita**.
- Fundo `#1A1A1A`, texto branco, bold, 13px.
- Padding: `7px` vertical, `10px` horizontal.
- Border-radius: `4px`.
- Largura aproximada do badge: `100px`.

### 6. Formas de Pagamento
- Título `"Formas de Pagamento:"` — 9px, bold.
- Cada forma de pagamento em linha separada — 9px, `#444444`.

### 7. Rodapé
- Linha separadora horizontal — `0.5px`, `#DDDDDD`.
- Nota: `*Os valores informados poderão ser eventualmente alterados pela companhia aérea.`
- 7.5px, `#999999`, **centralizado**.

---

## Interface TypeScript (Contrato de Dados)

```typescript
export interface AgenciaOrcamento {
  nome: string;
  email: string;
  site: string;
  telefone: string;
  logoPath?: string;       // caminho local ou URL do logo
}

export interface PassageirosOrcamento {
  adultos: number;
  criancas?: number;
  bebes?: number;
}

export interface BagagemOrcamento {
  despachada?: string;     // ex: "23kg" — undefined = sem bagagem despachada
  mao?: boolean;
  bolsa?: boolean;
}

export interface VooOrcamento {
  cia: string;             // ex: "GOL Linhas Aéreas"
  numero: string;          // ex: "8186"
  dataSaida: string;       // ex: "01/05/26"
  horaSaida: string;       // ex: "12:00h"
  dataChegada: string;
  horaChegada: string;
  origemCodigo: string;    // ex: "CGH"
  origemCidade: string;    // ex: "São Paulo"
  destinoCodigo: string;
  destinoCidade: string;
  duracao: string;         // ex: "01:30"
}

export interface DadosOrcamento {
  agencia: AgenciaOrcamento;
  dataOrcamento: string;   // ex: "29 de Abril, 2026"
  passageiros: PassageirosOrcamento;
  bagagem: BagagemOrcamento;
  voos: VooOrcamento[];
  valorTotal: string;      // ex: "R$ 1.000,00" (já formatado)
  formasPagamento: string[];
  notaRodape?: string;
}
```

---

## API Route sugerida (Next.js App Router)

```typescript
// app/api/orcamento/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { gerarOrcamentoPDF } from "@/lib/pdf/orcamento"; // implementar

export async function POST(req: NextRequest) {
  const dados: DadosOrcamento = await req.json();

  const pdfBuffer = await gerarOrcamentoPDF(dados);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orcamento.pdf"`,
    },
  });
}
```

---

## Implementação de referência (Python/ReportLab)

O arquivo `gerar_orcamento.py` na mesma pasta contém uma implementação funcional
completa usando Python + ReportLab. Execute com:

```bash
pip install reportlab
python gerar_orcamento.py
# → gera orcamento_referencia.pdf para comparação visual
```

---

## Checklist de validação

- [ ] Logo/nome da agência centralizado no topo
- [ ] Contato à esquerda, data à direita (mesma linha)
- [ ] Título "Orçamento" centralizado, bold, grande
- [ ] Passageiros e bagagem listados corretamente
- [ ] Tabela com header escuro e zebra striping
- [ ] 7 colunas com proporções corretas
- [ ] Badge de preço alinhado à direita com fundo escuro
- [ ] "Formas de Pagamento:" em bold
- [ ] Linha separadora antes do rodapé
- [ ] Nota de rodapé centralizada e pequena
- [ ] Fonte sem serifa em todo o documento
- [ ] Margens A4 respeitadas (18mm h / 20mm v)
