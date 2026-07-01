# Prompt de implementação: Módulo Financeiro e Fluxo de Caixa

## Contexto para a IA

Implemente um módulo financeiro completo para um sistema de gestão empresarial (ERP leve / back-office). O módulo deve cobrir:

- **Contas a receber** (receitas)
- **Contas a pagar** (despesas)
- **Cadastro de contas bancárias/caixa**
- **Categorias de despesas**
- **Dashboard financeiro** com KPIs
- **Relatório de resultados** (DRE simplificada por período)
- **Fluxo de caixa** consolidado e **por conta bancária**

**Não incluir:** integrações com fotografia, vídeo, produção, CRM de vendas específico, ou gateways de pagamento (Asaas, etc.) — a menos que solicitado depois. Campos opcionais de vínculo com vendas/clientes podem existir como FK genéricas.

**Stack de referência** (adaptável): Next.js App Router + Supabase/PostgreSQL + TypeScript + Recharts para gráficos. Use autenticação com papéis (roles).

**Moeda:** BRL (Real brasileiro), formatação `pt-BR`.

---

## 1. Visão geral do módulo

### 1.1 Estrutura de navegação sugerida

```
Financeiro
├── Dashboard                    (admin)
├── Contas a Receber
│   ├── A Receber               (admin, financeiro)
│   └── Recebidas               (admin, financeiro)
├── Contas a Pagar
│   ├── A Pagar                 (admin)
│   └── Pagas                   (admin)
└── Relatórios
    ├── Resultados              (admin)
    └── Fluxo de Caixa          (admin)

Admin
└── Contas Bancárias            (admin)
└── Categorias de Despesas      (admin)
```

### 1.2 Papéis e permissões

| Papel | Contas a Receber | Contas a Pagar | Relatórios / Dashboard | Contas Bancárias |
|-------|------------------|----------------|------------------------|------------------|
| **admin** | CRUD completo | CRUD completo | Acesso total | CRUD |
| **financeiro** (ou comercial) | CRUD recebíveis | Somente leitura ou sem acesso | Opcional | Leitura |
| **demais** | Sem acesso | Sem acesso | Sem acesso | Sem acesso |

Implementar helper `requireFinanceAccess(scope)`:

- `scope: 'receivable'` → admin + financeiro
- `scope: 'full'` → somente admin

---

## 2. Modelo de dados (PostgreSQL)

### 2.1 Tabela `bank_accounts` (contas bancárias / caixa)

```sql
CREATE TABLE bank_accounts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,                    -- ex: "Nubank PJ", "Caixa Loja"
  bank_name            text,                           -- ex: "Nubank", "Itaú"
  account_type         text NOT NULL DEFAULT 'checking'
                         CHECK (account_type IN ('checking', 'savings', 'cash', 'digital')),
  agency               text,
  account_number       text,
  pix_key              text,
  initial_balance      numeric(10,2) NOT NULL DEFAULT 0,
  initial_balance_date date NOT NULL DEFAULT CURRENT_DATE,
  color                text NOT NULL DEFAULT '#6B7280',  -- cor na UI (hex)
  is_primary           boolean NOT NULL DEFAULT false,   -- única conta principal
  is_active            boolean NOT NULL DEFAULT true,
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Apenas uma conta pode ser is_primary = true
CREATE UNIQUE INDEX idx_bank_accounts_single_primary
  ON bank_accounts (is_primary) WHERE is_primary = true;
```

**Tipos de conta (`account_type`):**

- `checking` → Conta Corrente
- `savings` → Poupança
- `cash` → Caixa Físico
- `digital` → Carteira Digital

**Regras:**

- Ao marcar uma conta como `is_primary = true`, desmarcar todas as outras.
- Não permitir DELETE se existirem lançamentos (`financial_entries` ou `financial_exits`) vinculados.
- Preferir `is_active = false` em vez de excluir contas com histórico.

---

### 2.2 Tabela `expense_categories` (categorias de despesas)

```sql
CREATE TABLE expense_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,    -- identificador estável: freela, marketing, etc.
  name       text NOT NULL UNIQUE,    -- rótulo exibido: "Marketing"
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Seed inicial sugerido:**

| slug | name |
|------|------|
| freela | Freela |
| marketing | Marketing |
| software | Software |
| imposto | Imposto |
| outro | Outro |

`financial_exits.category` referencia `expense_categories.slug` (FK).

Admin pode criar novas categorias; gerar `slug` a partir do nome (lowercase, sem acentos, underscores).

---

### 2.3 Tabela `financial_entries` (contas a receber)

```sql
CREATE TABLE financial_entries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vínculos opcionais (adaptar ao domínio do novo sistema):
  customer_id          uuid REFERENCES customers(id) ON DELETE SET NULL,  -- ou contacts
  source_id            uuid,           -- venda, contrato, pedido — FK opcional
  description          text,
  amount               numeric(10,2) NOT NULL,
  discount             numeric(10,2) NOT NULL DEFAULT 0,
  received_amount      numeric(10,2),  -- valor efetivamente recebido (pode diferir de amount)
  payment_method       text,           -- pix, cartao_credito, cartao_debito, boleto, transferencia, dinheiro
  installment_number   int NOT NULL DEFAULT 1,
  total_installments   int NOT NULL DEFAULT 1,
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'cancelled')),
  due_date             date,
  paid_date            date,           -- data do recebimento efetivo
  paid_at              timestamptz,    -- timestamp do recebimento
  bank_account_id      uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  receipt_url          text,
  notes                text,
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_entries_status ON financial_entries(status);
CREATE INDEX idx_financial_entries_due_date ON financial_entries(due_date);
CREATE INDEX idx_financial_entries_paid_date ON financial_entries(paid_date);
CREATE INDEX idx_financial_entries_bank_account ON financial_entries(bank_account_id);
```

**Status de recebíveis:**

| Status | Significado |
|--------|-------------|
| `pending` | Aguardando pagamento |
| `confirmed` | Confirmado (ex: boleto emitido) |
| `received` | Recebido — entra no fluxo de caixa |
| `overdue` | Vencido (pode ser setado manualmente ou por job) |
| `refunded` | Estornado |
| `cancelled` | Cancelado (soft delete) |

**Regra de valor no fluxo de caixa:** usar `received_amount ?? amount` quando `status = 'received'`.

---

### 2.4 Tabela `financial_exits` (contas a pagar)

```sql
CREATE TABLE financial_exits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description    text NOT NULL,
  category       text NOT NULL REFERENCES expense_categories(slug),
  amount         numeric(10,2) NOT NULL,
  due_date       date NOT NULL,
  paid_date      date,
  status         text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method text,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,  -- beneficiário interno, opcional
  source_id      uuid,           -- vínculo opcional com outro módulo
  receipt_url    text,
  notes          text,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_exits_status ON financial_exits(status);
CREATE INDEX idx_financial_exits_due_date ON financial_exits(due_date);
CREATE INDEX idx_financial_exits_paid_date ON financial_exits(paid_date);
CREATE INDEX idx_financial_exits_bank_account ON financial_exits(bank_account_id);
```

**Status de pagáveis:**

| Status | Significado |
|--------|-------------|
| `pending` | A pagar |
| `paid` | Pago — entra no fluxo de caixa |
| `overdue` | Vencido |
| `cancelled` | Cancelado |

**Exclusão:** recebíveis usam soft delete (`status = cancelled`); pagáveis podem ter DELETE físico (apenas admin).

---

## 3. Regras de negócio

### 3.1 Parcelamento (contas a receber)

Ao criar lançamento com `installments > 1` (máx. 10):

- Dividir `amount` igualmente entre parcelas (arredondar centavos na última se necessário).
- Cada parcela: `installment_number`, `total_installments`, `due_date` incrementada mês a mês.
- Descrição: `"Descrição — 1/3"`, `"Descrição — 2/3"`, etc.

### 3.2 Marcar como recebido

`PATCH /api/financial/entries/:id` com `{ mark_received: true, paid_date?, received_amount?, bank_account_id? }`:

- `status` → `received`
- `paid_date` → hoje ou informado
- `received_amount` → valor informado ou `amount` original
- `bank_account_id` → conta onde entrou o dinheiro (pré-selecionar conta `is_primary`)

### 3.3 Marcar como pago

`PATCH /api/financial/exits/:id` com `{ mark_paid: true, paid_date?, bank_account_id? }`:

- `status` → `paid`
- `paid_date` → hoje ou informado
- `bank_account_id` → conta de saída

### 3.4 Filtro de período

Presets: `hoje`, `semana`, `mes`, `3meses`, `6meses`, `ano`, `personalizado`.

**Contas a receber — visão "A Receber":** janela **futura** a partir de hoje até o fim do preset (`resolveReceivableForwardPeriod`).

**Contas recebidas / pagas / fluxo de caixa:** filtrar por `paid_date` no intervalo `[date_from, date_to]`.

**Campo de data configurável nas listagens:** `date_field` = `due_date` (padrão em aberto) ou `paid_date` (histórico).

### 3.5 Vencidos

Status `overdue` existe no schema. KPIs de vencidos também consideram `pending` com `due_date < hoje`. Implementar cron/job opcional para atualizar `pending` → `overdue` automaticamente.

### 3.6 Fluxo de caixa — o que entra no cálculo

**Entradas:** `financial_entries` onde `status = 'received'` e `paid_date` no período.

**Saídas:** `financial_exits` onde `status = 'paid'` e `paid_date` no período.

**Valor entrada:** `received_amount ?? amount`.

Lançamentos sem `bank_account_id` entram apenas no **consolidado**, não na conta individual.

### 3.7 Saldo por conta bancária

Para cada conta ativa:

```
saldoInicial = initial_balance (na primeira linha do período)
saldoFinal[mês] = saldoAnterior + entradas[mês] - saídas[mês]
saldoAtual = saldo após último mês do período
```

**Importante:** o saldo por conta usa `initial_balance` como ponto de partida no primeiro mês exibido — não recalcula movimentos anteriores ao período filtrado. Para saldo real contábil, considerar evolução futura com saldo de abertura calculado até `initial_balance_date`.

### 3.8 Fluxo consolidado

Soma todas as entradas/saídas do período **sem** considerar `initial_balance` das contas. Saldo acumulado parte de zero no início do intervalo selecionado.

---

## 4. APIs REST

### 4.1 Contas a receber

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/api/financial/entries` | receivable | Lista paginada (50/página) |
| POST | `/api/financial/entries` | receivable | Cria lançamento(s) com parcelas |
| PATCH | `/api/financial/entries/:id` | receivable | Atualiza / marca recebido |
| DELETE | `/api/financial/entries/:id` | receivable | Soft delete → `cancelled` |
| DELETE | `/api/financial/entries/bulk` | receivable | Body: `{ ids: string[] }` → cancela em massa |

**Query params GET:**

- `status`, `payment_method`, `search`, `page`
- `date_from`, `date_to`, `date_field` (`due_date` | `paid_date`)
- Default sem status: `pending`, `confirmed`, `overdue`, `refunded` (não lista `received` nem `cancelled`)

**POST body:**

```json
{
  "description": "Serviço X",
  "amount": 3000,
  "customer_id": "uuid-opcional",
  "payment_method": "pix",
  "due_date": "2026-07-15",
  "installments": 3,
  "notes": ""
}
```

### 4.2 Contas a pagar

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/api/financial/exits` | full | Lista paginada |
| POST | `/api/financial/exits` | full | Cria despesa |
| PATCH | `/api/financial/exits/:id` | full | Atualiza / marca pago |
| DELETE | `/api/financial/exits/:id` | full | Exclusão física |

**Query params GET:** `status`, `category`, `search`, `date_from`, `date_to`, `date_field`, `page`

### 4.3 Contas bancárias (admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/bank-accounts` | Lista todas |
| POST | `/api/admin/bank-accounts` | Cria conta |
| PATCH | `/api/admin/bank-accounts/:id` | Edita / define `is_primary` / `is_active` |
| DELETE | `/api/admin/bank-accounts/:id` | Exclui se sem lançamentos |

### 4.4 Relatórios e métricas

| Método | Rota | Permissão | Retorno |
|--------|------|-----------|---------|
| GET | `/api/financial/dashboard?date_from&date_to` | full | KPIs + gráficos mensais + aging |
| GET | `/api/financial/metrics?type=receivable\|payable&...` | conforme tipo | Cards de resumo |
| GET | `/api/financial/relatorios?date_from&date_to` | full | DRE simplificada |
| GET | `/api/financial/fluxo-caixa?date_from&date_to&by_account=true` | full | Fluxo consolidado + por conta |

---

## 5. Algoritmos principais (TypeScript)

### 5.1 `monthsInRange(start, end)` → `['2026-01', '2026-02', ...]`

Iterar ano/mês entre `start` e `end` (strings `YYYY-MM-DD`).

### 5.2 `fetchFluxoCaixaData(supabase, start, end)`

```typescript
// Pseudocódigo
entries = SELECT amount, received_amount, paid_date
          FROM financial_entries
          WHERE status = 'received' AND paid_date BETWEEN start AND end

exits = SELECT amount, paid_date
        FROM financial_exits
        WHERE status = 'paid' AND paid_date BETWEEN start AND end

Para cada mês no range:
  entradas[mês] = SUM(entries onde paid_date começa com YYYY-MM)
  saidas[mês] = SUM(exits onde paid_date começa com YYYY-MM)

saldoAcum = 0
Para cada mês:
  saldoInicial = saldoAcum
  saldoFinal = saldoInicial + entradas - saidas
  saldoAcum = saldoFinal

return { rows, totalEntradas, totalSaidas, saldoAtual: saldoAcum }
```

### 5.3 `fetchFluxoCaixaPorConta(supabase, start, end)`

1. Buscar contas ativas (`is_active = true`).
2. Buscar entries/exits do período com `bank_account_id`.
3. Para cada conta: filtrar lançamentos, agregar por mês, iniciar `saldoAcum = initial_balance`.
4. Retornar `{ accounts: BankAccountBalance[], consolidated: fetchFluxoCaixaData() }`.

### 5.4 `aggregateFinancialDashboardByRange(entries, exits, periodStart, periodEnd)`

KPIs calculados:

- `recebidoPeriodo` — received com paid_date no período
- `aReceberPeriodo` — pending/overdue com due_date no período
- `pagoPeriodo` — paid com paid_date no período
- `aPagarPeriodo` — pending/overdue com due_date no período
- `saldoPeriodo` = recebidoPeriodo - pagoPeriodo
- `vencidasReceber` / `vencidasPagar` — due_date < hoje
- `totalAReceber` — todo pending/overdue
- `recebidoAno` / `aReceberAno` — acumulado do ano civil
- `monthly[]` — recebido, aReceber, pago, resultado por mês
- `byMethod[]` — receitas por forma de pagamento
- `byCategory[]` — despesas por categoria
- `aging` — faixas 0-30, 31-60, 61-90, 90+ dias de atraso (recebíveis vencidos)

### 5.5 `fetchRelatorioData` (Resultados)

Similar ao dashboard, retorna:

- `monthly`: receita, despesa, resultado por mês
- `byMethod`, `byCategory`
- `summary`: receita, despesa, resultado, margem (%)

---

## 6. Interfaces TypeScript

```typescript
type BankAccountType = 'checking' | 'savings' | 'cash' | 'digital'
type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia' | 'dinheiro'
type EntryStatus = 'pending' | 'confirmed' | 'received' | 'overdue' | 'refunded' | 'cancelled'
type ExitStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

interface BankAccount {
  id: string
  name: string
  bank_name: string | null
  account_type: BankAccountType
  agency: string | null
  account_number: string | null
  pix_key: string | null
  initial_balance: number
  initial_balance_date: string
  color: string
  is_primary: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
}

interface FinancialEntry {
  id: string
  customer_id: string | null
  source_id: string | null
  description: string | null
  amount: number
  discount: number
  received_amount: number | null
  payment_method: string | null
  installment_number: number
  total_installments: number
  status: EntryStatus
  due_date: string | null
  paid_date: string | null
  bank_account_id: string | null
  receipt_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

interface FinancialExit {
  id: string
  description: string
  category: string  // slug da expense_categories
  amount: number
  due_date: string
  paid_date: string | null
  status: ExitStatus
  payment_method: string | null
  bank_account_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

interface CashflowRow {
  month: string       // "Jan", "Fev", ...
  saldoInicial: number
  entradas: number
  saidas: number
  saldoFinal: number
}

interface BankAccountBalance {
  id: string
  name: string
  bank_name: string | null
  color: string
  initial_balance: number
  totalEntradas: number
  totalSaidas: number
  saldoAtual: number
  rows: CashflowRow[]
}
```

---

## 7. Telas e componentes UI

### 7.1 Componente compartilhado: `FinancePeriodFilter`

- Botões de preset (Hoje, Semana, Mês, 3 Meses, 6 Meses, Ano, Personalizado).
- Personalizado: dois `<input type="date">` + botão Aplicar.
- Emite `FinancePeriod { preset, start, end }`.

### 7.2 Componente: `BankAccountSelect`

- Dropdown com logo/nome do banco.
- `getDefaultBankAccountId(accounts)` → conta `is_primary` ou primeira da lista.
- Usado ao marcar recebido/pago.

### 7.3 Componente: `CurrencyInput`

- Máscara BRL (centavos como dígitos).
- Funções: `formatBRL`, `parseBRL`, `maskBRLInput`, `formatBRLChartTick`.

### 7.4 Tela: Contas a Receber (`ContasReceberClient`)

**Cards de métricas:** A Receber (futuro), Recebido no período, Recebido no ano, Vencidas.

**Filtros:** período, status, forma de pagamento, busca textual.

**Tabela:** cliente, descrição, valor, vencimento, status, parcela, criado por.

**Ações:**

- Criar lançamento (modal com parcelas)
- Editar
- Marcar como recebido (modal: data, valor recebido, conta bancária)
- Cancelar (individual ou em massa com checkbox)

**Sub-rota Recebidas:** `filterStatus = 'received'`, filtro por `paid_date`.

### 7.5 Tela: Contas a Pagar (`ContasPagarClient`)

Estrutura espelhada: métricas (A Pagar, Pago no mês, Vencidas), filtros por categoria, marcar pago com conta bancária.

### 7.6 Tela: Dashboard Financeiro

**KPIs (grid):** Recebido, A Receber, Pago, A Pagar, Saldo, Vencidas.

**Gráficos:**

- Barras mensais: recebido vs pago
- Pizza: por forma de pagamento
- Pizza: despesas por categoria
- Aging de recebíveis vencidos

### 7.7 Tela: Fluxo de Caixa (`FluxoCaixaClient`)

**Layout:**

1. Título + `FinancePeriodFilter`
2. **Cards por conta** (grid): nome, saldo do período, entradas ↑, saídas ↓ — clicável para filtrar
3. **Tabs:** Consolidado | Conta A | Conta B | ...
4. **3 KPI cards:** Total entradas, Total saídas, Saldo do período
5. **Gráfico linha:** saldo acumulado por mês (`saldoFinal`)
6. **Gráfico barras:** entradas vs saídas por mês
7. **Tabela:** Mês | Saldo inicial | Entradas | Saídas | Saldo final

**Biblioteca de gráficos:** Recharts (`LineChart`, `BarChart`, `ResponsiveContainer`, `ReferenceLine` em y=0).

### 7.8 Tela: Contas Bancárias (Admin)

**Lista:** nome, banco, tipo, saldo inicial, cor, badge "Principal", ativa/inativa.

**Modal criar/editar:**

- Nome*, banco (autocomplete opcional), tipo, agência, número, PIX
- Saldo inicial + data do saldo
- Cor (paleta preset + color picker)
- Toggle principal / ativa

---

## 8. Formatação e localização

```typescript
// formatBRL(1234.56) → "R$ 1.234,56"
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Labels de mês
const MONTH_LABELS = { '01':'Jan', '02':'Fev', ... '12':'Dez' }

// Formas de pagamento
const METHOD_LABEL = {
  pix: 'Pix',
  cartao_credito: 'Cartão',
  cartao_debito: 'Cartão débito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
}
```

---

## 9. Segurança (RLS Supabase — adaptar)

- `financial_entries`: SELECT para equipe financeira; INSERT/UPDATE para admin + financeiro.
- `financial_exits`: SELECT equipe; ALL apenas admin.
- `bank_accounts`: ALL admin; SELECT admin + financeiro.
- `expense_categories`: SELECT equipe; ALL admin.

Usar função `current_role()` baseada no JWT/profile do usuário.

---

## 10. Ordem de implementação sugerida

### Fase 1 — Fundação

1. Migrations: `expense_categories`, `bank_accounts`, `financial_entries`, `financial_exits`
2. Types TypeScript
3. `requireFinanceAccess`, `periodFilter`, `formatBRL`
4. CRUD APIs de contas bancárias e categorias

### Fase 2 — Operação

5. APIs entries/exits (GET, POST, PATCH, DELETE)
6. Telas Contas a Receber e Contas a Pagar
7. `BankAccountSelect`, modais de receber/pagar

### Fase 3 — Análise

8. `aggregate.ts` + API `/dashboard`
9. `reportQueries.ts` + APIs `/relatorios` e `/fluxo-caixa`
10. Telas Dashboard, Resultados, Fluxo de Caixa

### Fase 4 — Polimento

11. Bulk cancel recebíveis
12. Job de vencidos (opcional)
13. Testes de integração nos cálculos de saldo

---

## 11. Casos de teste críticos

1. Parcelamento 3x de R$ 100 → três lançamentos de R$ 33,33 ou R$ 33,34 na última.
2. Recebimento parcial: `amount=100`, `received_amount=80` → fluxo usa 80.
3. Lançamento sem `bank_account_id` → aparece no consolidado, não na conta X.
4. Conta com `initial_balance=5000` → primeira linha do fluxo por conta parte de 5000.
5. Período personalizado atravessando meses → `monthsInRange` inclui todos os meses.
6. DELETE conta com lançamentos → erro 409.
7. Duas contas `is_primary` → constraint impede.
8. Lista "A Receber" default não mostra `received` nem `cancelled`.

---

## 12. O que NÃO portar do sistema original

- Integração Asaas (`asaas_id`, `asaas_payment_id`, cobranças automáticas)
- Geração automática de entries a partir de pedidos/contratos (`ensureOrderFinancialEntries`)
- Relatório "Resultado de Vendas" com fotógrafas/produtos
- Campos `order_id` específicos — substituir por `source_id` genérico se necessário
- Módulo de comissões de freelancers

---

## 13. Critérios de aceite

- [ ] Admin cadastra contas bancárias e define conta principal
- [ ] Usuário financeiro cria recebíveis com parcelas e marca como recebido vinculando conta
- [ ] Admin cria pagáveis, categoriza e marca como pago
- [ ] Dashboard exibe KPIs corretos para o período selecionado
- [ ] Fluxo de caixa mostra consolidado + breakdown por conta com gráficos e tabela
- [ ] Relatório de resultados exibe receita, despesa, margem por mês
- [ ] Permissões respeitadas em todas as rotas
- [ ] Valores formatados em BRL em toda a UI

---

## 14. Referência no sistema de origem (Hanna Sistema)

| Área | Caminho |
|------|---------|
| Migrations | `supabase/migrations/011_financial_tables_redesign.sql`, `054_expense_categories.sql`, `066_bank_accounts.sql`, `067_bank_account_fk.sql`, `068_bank_accounts_is_primary.sql` |
| Lógica de negócio | `src/lib/financial/` |
| APIs | `src/app/api/financial/` |
| Admin contas | `src/app/api/admin/bank-accounts/` |
| UI | `src/app/(dashboard)/dashboard/financeiro/` |
| Componentes | `src/components/financeiro/` |
| Types | `src/types/index.ts` (seção Financial) |
