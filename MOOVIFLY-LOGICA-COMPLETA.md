# MooviFly — Lógica Completa, Design System e Schema do Banco

> **Este arquivo contém TODA a lógica de negócio, design system e código-fonte do sistema MooviFly.**
> Use como referência para recriar o projeto do zero.

---

## 1. VISÃO GERAL DO SISTEMA

**MooviFly** é uma plataforma composta por:
1. **Site público (Landing Page)** — fundo escuro `#0a0a0a`, seções de marketing
2. **Backoffice interno** — CRM/ERP para gestão da agência de viagens
3. **Edge Functions (Supabase Deno)** — integração de pagamento via AbacatePay

**Stack:**
- Next.js 16.2.4 (App Router) + React 19 + TypeScript 5.7
- Tailwind CSS 4 + CSS Variables (design tokens)
- Supabase (Auth + Postgres + Edge Functions)
- AbacatePay (checkout com PIX + cartão)
- Lucide Icons, Recharts, sonner (toast), jsPDF, next-themes

**Contatos/Dados da empresa:**
- WhatsApp: `(11) 93476-2251` → `https://wa.me/5511934762251`
- Instagram: `https://www.instagram.com/moovifly`
- Email: `contato@moovifly.com.br`
- Domínio: `moovifly.com.br`

---

## 2. DESIGN SYSTEM COMPLETO

### 2.1 Fontes
```css
/* Google Fonts */
DM Sans  → --font-dm-sans  (corpo/sans-serif)
Outfit   → --font-outfit   (display/títulos)

font-family: var(--font-sans)    /* corpo */
font-family: var(--font-display) /* títulos */
```

### 2.2 Tokens CSS Completos (globals.css)

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  --font-sans: var(--font-dm-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-display: var(--font-outfit), -apple-system, BlinkMacSystemFont, sans-serif;

  --color-background: var(--bg-base);
  --color-foreground: var(--text-primary);
  --color-card: var(--bg-card);
  --color-card-foreground: var(--text-primary);
  --color-popover: var(--bg-card);
  --color-popover-foreground: var(--text-primary);
  --color-primary: var(--accent-600);
  --color-primary-foreground: #ffffff;
  --color-secondary: var(--bg-elevated);
  --color-secondary-foreground: var(--text-primary);
  --color-muted: var(--bg-overlay);
  --color-muted-foreground: var(--text-secondary);
  --color-accent: var(--bg-overlay);
  --color-accent-foreground: var(--text-primary);
  --color-destructive: var(--danger-text);
  --color-destructive-foreground: #ffffff;
  --color-border: var(--border-default);
  --color-input: var(--border-default);
  --color-ring: var(--accent-600);
  --color-success: var(--success-text);
  --color-warning: var(--warning-text);
  --color-info: var(--info-text);
}

/* LIGHT THEME (backoffice padrão) */
:root {
  --bg-base: #f4f6fc;
  --bg-surface: #ffffff;
  --bg-elevated: #f9fafb;
  --bg-overlay: #f0f2f5;
  --bg-card: #ffffff;
  --bg-hover: rgba(45, 80, 22, 0.04);
  --bg-active: rgba(45, 80, 22, 0.08);

  --border-dim: rgba(0, 0, 0, 0.05);
  --border-subtle: rgba(0, 0, 0, 0.08);
  --border-default: rgba(0, 0, 0, 0.12);
  --border-strong: rgba(0, 0, 0, 0.2);

  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-muted: #999999;
  --text-inverse: #ffffff;

  /* Verde MooviFly */
  --accent-300: #7fa984;
  --accent-400: #4a7c59;
  --accent-500: #3d6b47;
  --accent-600: #2d5016;
  --accent-gold: #d4c4a8;
  --accent-glow: rgba(45, 80, 22, 0.12);
  --accent-glow-sm: rgba(45, 80, 22, 0.08);

  /* Roxo */
  --purple-300: #b8c5d6;
  --purple-500: #7c8db0;
  --purple-700: #4a5568;
  --purple-glow: rgba(124, 141, 176, 0.12);

  /* Teal */
  --teal-400: #a8cecc;
  --teal-500: #14b8a6;
  --teal-glow: rgba(168, 206, 204, 0.15);

  /* Status */
  --success-bg: #c8e6c9;
  --success-text: #2d5016;
  --success-border: rgba(45, 80, 22, 0.25);

  --warning-bg: rgba(212, 196, 168, 0.3);
  --warning-text: #8b7e6a;
  --warning-border: rgba(139, 126, 106, 0.3);

  --danger-bg: rgba(183, 28, 28, 0.1);
  --danger-text: #b71c1c;
  --danger-border: rgba(183, 28, 28, 0.25);

  --info-bg: rgba(168, 206, 204, 0.2);
  --info-text: #4a7c59;
  --info-border: rgba(74, 124, 89, 0.25);

  /* Layout */
  --sidebar-width: 80px;
  --topbar-height: 66px;

  /* Radii */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 22px;
  --radius-full: 9999px;

  /* Sombras */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
  --shadow-glow: 0 0 24px rgba(45,80,22,0.15);

  /* Transições */
  --ease-fast: 100ms cubic-bezier(0.4, 0, 0.2, 1);
  --ease-default: 180ms cubic-bezier(0.4, 0, 0.2, 1);
  --ease-smooth: 260ms cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* DARK THEME */
[data-theme="dark"] {
  --bg-base: #070b18;
  --bg-surface: #0b1121;
  --bg-elevated: #11192e;
  --bg-overlay: #182338;
  --bg-card: #1e2b42;
  --bg-hover: rgba(255,255,255,0.035);
  --bg-active: rgba(45,80,22,0.15);

  --border-dim: rgba(255,255,255,0.05);
  --border-subtle: rgba(255,255,255,0.09);
  --border-default: rgba(255,255,255,0.14);
  --border-strong: rgba(255,255,255,0.24);

  --text-primary: #edf0f7;
  --text-secondary: #8896b0;
  --text-muted: #4a5770;
  --text-inverse: #070b18;

  --accent-glow: rgba(45,80,22,0.18);
  --accent-glow-sm: rgba(45,80,22,0.10);

  --success-bg: rgba(200,230,201,0.12);
  --success-text: #7fa984;
  --success-border: rgba(127,169,132,0.25);

  --shadow-xs: 0 1px 3px rgba(0,0,0,0.45);
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.5);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.55);
  --shadow-lg: 0 20px 50px rgba(0,0,0,0.65);
  --shadow-glow: 0 0 28px rgba(45,80,22,0.25);
}
```

### 2.3 Identidade Visual da Home (Marketing)
- Fundo fixo: `#0a0a0a` (preto absoluto)
- Texto: `white` / `white/60` / `white/70` / `white/85`
- Botão CTA: branco com texto preto
- Gradiente ícones/accent: `from-[#7FA984] to-[#2D5016]`
- Cards: `border-white/10`, `bg-white/[0.03]`
- Hover cards: `-translate-y-1 border-white/20 bg-white/[0.06]`

---

## 3. ESTRUTURA DE ARQUIVOS DO PROJETO

```
moovifly/
├── app/
│   ├── layout.tsx                    # Root: fontes, providers, metadata
│   ├── page.tsx                      # Home → renderiza SiteHome
│   ├── globals.css                   # Design tokens
│   └── _site/                        # Site público (landing)
│       ├── site-home.tsx             # Orquestra seções
│       ├── site-navbar.tsx           # Navbar fixa com scroll
│       ├── site-hero.tsx             # Hero com typewriter
│       ├── quem-somos.tsx            # Seção sobre a empresa
│       ├── cotacao-section.tsx       # Formulário cotação → WhatsApp
│       ├── confessional.tsx          # Missão da empresa
│       ├── servicos.tsx              # Grade de serviços
│       ├── contato.tsx               # Formulário contato → WhatsApp
│       └── site-footer.tsx           # Rodapé
│   └── backoffice/
│       ├── layout.tsx                # Wrapper backoffice
│       ├── login/
│       │   ├── page.tsx
│       │   └── login-form.tsx        # Login Supabase Auth
│       ├── pagamento-concluido/
│       │   ├── page.tsx
│       │   └── pagamento-concluido-client.tsx
│       └── (shell)/                  # Rotas protegidas
│           ├── layout.tsx            # BackofficeShell (auth gate)
│           ├── dashboard/            # Dashboard + gráficos Recharts
│           ├── clientes/             # CRUD clientes
│           ├── orcamentos/           # CRUD orçamentos com voos
│           ├── vendas/               # CRUD vendas
│           ├── financeiro/           # Contas a receber/pagar + comissões
│           ├── relatorios/           # Relatórios (admin/gerente)
│           ├── configuracoes/        # Configurações (admin)
│           └── checkout/             # Checkout AbacatePay
├── components/
│   ├── backoffice/
│   │   ├── backoffice-shell.tsx      # Layout sidebar + conteúdo
│   │   ├── sidebar.tsx               # Navegação lateral icon-only (80px)
│   │   └── topbar.tsx                # Topbar com título + ações + theme toggle
│   ├── providers/
│   │   ├── auth-provider.tsx         # Context Auth + proteção de rotas
│   │   └── theme-provider.tsx        # next-themes (dark/light)
│   ├── ui/                           # shadcn-like components
│   │   ├── button.tsx, card.tsx, input.tsx, label.tsx
│   │   ├── select.tsx, textarea.tsx, table.tsx
│   │   ├── dialog.tsx, tabs.tsx, badge.tsx
│   │   ├── avatar.tsx, skeleton.tsx
│   │   ├── separator.tsx, dropdown.tsx
│   │   └── sonner.tsx
│   ├── autocomplete.tsx              # Combobox com busca
│   ├── confirm-modal.tsx             # Modal de confirmação imperativo
│   └── theme-toggle.tsx              # Botão troca tema
├── lib/
│   ├── auth.ts                       # signIn, signOut, getUserProfile, ROLE_LABELS
│   ├── supabase/client.ts            # Singleton createBrowserClient
│   ├── utils.ts                      # cn() (clsx + tailwind-merge)
│   ├── format.ts                     # formatCurrency, formatDate, formatPhoneBR, etc.
│   ├── masks.ts                      # Máscaras input (tel, CPF, CNPJ)
│   └── datasets.ts                   # loadAeroportos, loadCompanhias, search
├── supabase/
│   └── functions/
│       ├── criar-checkout-abacatepay/ # Edge Function principal de checkout
│       ├── webhook-abacatepay/        # Webhook de confirmação de pagamento
│       ├── criar-checkout-asaas/      # (legado/alternativo)
│       └── webhook-asaas/             # (legado/alternativo)
├── public/
│   ├── assets/images/
│   │   ├── HERO_SITE.png             # Imagem hero da landing
│   │   └── moovifly_logo_branco.png  # Logo branco
│   ├── favicon.png
│   └── data/
│       ├── aeroportos.json           # ~3000 aeroportos mundiais
│       └── companhias-aereas.json    # ~200 companhias aéreas
└── docs/
    └── sql-historico/                # Todos os scripts SQL históricos
```

---

## 4. CONFIGURAÇÕES DO PROJETO

### 4.1 package.json (dependências)
```json
{
  "dependencies": {
    "@supabase/ssr": "^0.10.2",
    "@supabase/supabase-js": "^2.39.7",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.7",
    "lucide-react": "^0.468.0",
    "next": "16.2.4",
    "next-themes": "^0.4.4",
    "react": "19.2.5",
    "react-dom": "19.2.5",
    "recharts": "^3.8.1",
    "sonner": "^1.7.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.2.4",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "tailwindcss": "4.2.4",
    "tw-animate-css": "^1.2.0",
    "typescript": "^5.7.2"
  }
}
```

### 4.2 next.config.ts
**IMPORTANTE:** O projeto atual usa `output: "export"` (site estático).
Para funcionar com Vercel com SSR, remover o `output: "export"`.
```ts
const nextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};
```

### 4.3 Variáveis de Ambiente (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://axrkvvjnubjxgejvrbmf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_p12DlauhX8MfP617h5eD7g_RsnbKVwn
```

---

## 5. BANCO DE DADOS — SCHEMA COMPLETO

### 5.1 Tabelas Principais

#### `usuarios` — Perfis do backoffice
```sql
CREATE TABLE usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('administrador', 'gerente', 'vendedor')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usuarios_user_id ON usuarios(user_id);
CREATE INDEX idx_usuarios_tipo ON usuarios(tipo);
```

#### `clientes` — Base de clientes da agência
```sql
CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  vendedor_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_status ON clientes(status);
CREATE INDEX idx_clientes_vendedor ON clientes(vendedor_id);
```

#### `orcamentos` — Cotações/propostas de viagem
```sql
CREATE TABLE orcamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_orcamento TEXT UNIQUE,
  cliente_id UUID REFERENCES clientes(id),
  vendedor_id UUID REFERENCES usuarios(id),
  data_orcamento DATE NOT NULL DEFAULT CURRENT_DATE,
  adultos INTEGER DEFAULT 1,
  criancas INTEGER DEFAULT 0,
  bebes INTEGER DEFAULT 0,
  com_bagagem BOOLEAN DEFAULT true,
  voos JSONB DEFAULT '[]',  -- Array de Voo[]
  valor_total NUMERIC(12,2) DEFAULT 0,
  forma_pagamento TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'pendente' CHECK (
    status IN ('pendente','enviado','aprovado','recusado','convertido')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tipo Voo (estrutura JSONB):
-- { tipo: "ida"|"volta", origem: string, destino: string, data: string,
--   horario_saida: string, horario_chegada: string, companhia: string, numero_voo: string }

CREATE INDEX idx_orcamentos_cliente ON orcamentos(cliente_id);
CREATE INDEX idx_orcamentos_vendedor ON orcamentos(vendedor_id);
CREATE INDEX idx_orcamentos_status ON orcamentos(status);
```

#### `vendas` — Vendas confirmadas
```sql
CREATE TABLE vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_venda TEXT UNIQUE,
  cliente_id UUID REFERENCES clientes(id),
  vendedor_id UUID REFERENCES usuarios(id),
  orcamento_id UUID REFERENCES orcamentos(id),
  tipo TEXT, -- 'passagem', 'pacote', 'hospedagem', 'corporativo', 'lua-de-mel', 'grupo', 'outros'
  origem TEXT,
  destino TEXT,
  data_ida DATE,
  data_volta DATE,
  data_venda DATE DEFAULT CURRENT_DATE,
  valor_total NUMERIC(12,2) DEFAULT 0,
  taxa_rav NUMERIC(12,2) DEFAULT 0,  -- taxa agência
  taxa_du NUMERIC(12,2) DEFAULT 0,   -- taxa DU
  comissao_percentual NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (
    status IN ('pendente','confirmada','concluida','cancelada')
  ),
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX idx_vendas_vendedor ON vendas(vendedor_id);
CREATE INDEX idx_vendas_status ON vendas(status);
CREATE INDEX idx_vendas_created_at ON vendas(created_at);
```

#### `contas_receber` — Contas a receber
```sql
CREATE TABLE contas_receber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID REFERENCES vendas(id),
  cliente_id UUID REFERENCES clientes(id),
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE,
  data_recebimento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','recebido','cancelado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `contas_pagar` — Contas a pagar (admin/gerente)
```sql
CREATE TABLE contas_pagar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID REFERENCES vendas(id),
  fornecedor TEXT,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `comissoes` — Comissões dos vendedores
```sql
CREATE TABLE comissoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID REFERENCES vendas(id),
  usuario_id UUID REFERENCES usuarios(id),
  valor NUMERIC(12,2) NOT NULL,
  percentual NUMERIC(5,2),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  data_pagamento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comissoes_usuario ON comissoes(usuario_id);
CREATE INDEX idx_comissoes_venda ON comissoes(venda_id);
```

#### `pagamentos` — Pagamentos via checkout AbacatePay
```sql
CREATE TABLE pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID REFERENCES vendas(id),
  checkout_id TEXT,
  checkout_url TEXT,
  valor NUMERIC(12,2),
  status TEXT DEFAULT 'pending',
  metodo_pagamento TEXT DEFAULT 'checkout_abacatepay',
  dados_pagamento JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pagamentos_venda ON pagamentos(venda_id);
CREATE UNIQUE INDEX idx_pagamentos_checkout_id ON pagamentos(checkout_id) WHERE checkout_id IS NOT NULL;
```

#### `atividades` — Log de ações dos usuários
```sql
CREATE TABLE atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  tipo TEXT NOT NULL,  -- 'login', 'logout', etc.
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 Triggers

```sql
-- Auto-atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendas_updated_at BEFORE UPDATE ON vendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orcamentos_updated_at BEFORE UPDATE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-numeração de vendas
CREATE OR REPLACE FUNCTION generate_numero_venda()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_venda IS NULL THEN
    NEW.numero_venda = 'V' || TO_CHAR(NOW(), 'YYYY') || LPAD(nextval('vendas_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE SEQUENCE IF NOT EXISTS vendas_seq START 1;

CREATE TRIGGER trigger_generate_numero_venda BEFORE INSERT ON vendas
  FOR EACH ROW EXECUTE FUNCTION generate_numero_venda();

-- Auto-numeração de orçamentos
CREATE OR REPLACE FUNCTION generate_numero_orcamento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_orcamento IS NULL THEN
    NEW.numero_orcamento = 'ORC' || TO_CHAR(NOW(), 'YYYY') || LPAD(nextval('orcamentos_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE SEQUENCE IF NOT EXISTS orcamentos_seq START 1;

CREATE TRIGGER trigger_generate_numero_orcamento BEFORE INSERT ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION generate_numero_orcamento();

-- Auto-criar comissão ao confirmar venda
CREATE OR REPLACE FUNCTION create_comissao_on_venda()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmada' AND OLD.status != 'confirmada' THEN
    IF NEW.vendedor_id IS NOT NULL AND NEW.comissao_percentual > 0 THEN
      INSERT INTO comissoes (venda_id, usuario_id, valor, percentual, status)
      VALUES (
        NEW.id,
        NEW.vendedor_id,
        (NEW.valor_total * NEW.comissao_percentual / 100),
        NEW.comissao_percentual,
        'pendente'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_comissao_on_venda AFTER UPDATE ON vendas
  FOR EACH ROW EXECUTE FUNCTION create_comissao_on_venda();
```

### 5.3 RLS (Row Level Security)

```sql
-- Habilitar RLS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;

-- Helper: pegar tipo do usuário logado
CREATE OR REPLACE FUNCTION get_user_tipo()
RETURNS TEXT AS $$
  SELECT tipo FROM usuarios WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: pegar id do perfil do usuário logado
CREATE OR REPLACE FUNCTION get_user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM usuarios WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- usuarios: cada usuário vê seu próprio perfil; admin/gerente veem todos
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT USING (
  user_id = auth.uid() OR get_user_tipo() IN ('administrador', 'gerente')
);
CREATE POLICY "usuarios_update_self" ON usuarios FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "usuarios_all_admin" ON usuarios FOR ALL USING (get_user_tipo() = 'administrador');

-- clientes: vendedor vê só os seus; admin/gerente veem todos
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (
  get_user_tipo() IN ('administrador', 'gerente') OR vendedor_id = get_user_profile_id()
);
CREATE POLICY "clientes_insert" ON clientes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "clientes_update" ON clientes FOR UPDATE USING (
  get_user_tipo() IN ('administrador', 'gerente') OR vendedor_id = get_user_profile_id()
);
CREATE POLICY "clientes_delete" ON clientes FOR DELETE USING (
  get_user_tipo() IN ('administrador', 'gerente') OR vendedor_id = get_user_profile_id()
);

-- orcamentos: vendedor vê só os seus
CREATE POLICY "orcamentos_select" ON orcamentos FOR SELECT USING (
  get_user_tipo() IN ('administrador', 'gerente') OR vendedor_id = get_user_profile_id()
);
CREATE POLICY "orcamentos_insert" ON orcamentos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "orcamentos_update" ON orcamentos FOR UPDATE USING (
  get_user_tipo() IN ('administrador', 'gerente') OR vendedor_id = get_user_profile_id()
);
CREATE POLICY "orcamentos_delete" ON orcamentos FOR DELETE USING (
  get_user_tipo() IN ('administrador', 'gerente') OR vendedor_id = get_user_profile_id()
);

-- vendas: vendedor vê só as suas
CREATE POLICY "vendas_select" ON vendas FOR SELECT USING (
  get_user_tipo() IN ('administrador', 'gerente') OR vendedor_id = get_user_profile_id()
);
CREATE POLICY "vendas_insert" ON vendas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "vendas_update" ON vendas FOR UPDATE USING (
  get_user_tipo() IN ('administrador', 'gerente') OR vendedor_id = get_user_profile_id()
);
CREATE POLICY "vendas_delete" ON vendas FOR DELETE USING (
  get_user_tipo() IN ('administrador', 'gerente')
);

-- contas_receber: todos os autenticados veem
CREATE POLICY "contas_receber_all" ON contas_receber FOR ALL USING (auth.uid() IS NOT NULL);

-- contas_pagar: apenas admin/gerente
CREATE POLICY "contas_pagar_all" ON contas_pagar FOR ALL USING (
  get_user_tipo() IN ('administrador', 'gerente')
);

-- comissoes: vendedor vê as suas; admin/gerente veem todas
CREATE POLICY "comissoes_select" ON comissoes FOR SELECT USING (
  get_user_tipo() IN ('administrador', 'gerente') OR usuario_id = get_user_profile_id()
);
CREATE POLICY "comissoes_update" ON comissoes FOR UPDATE USING (
  get_user_tipo() IN ('administrador', 'gerente')
);

-- pagamentos: todos autenticados
CREATE POLICY "pagamentos_all" ON pagamentos FOR ALL USING (auth.uid() IS NOT NULL);

-- atividades: cada usuário insere e vê as suas; admin vê todas
CREATE POLICY "atividades_insert" ON atividades FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "atividades_select" ON atividades FOR SELECT USING (
  get_user_tipo() = 'administrador' OR usuario_id = get_user_profile_id()
);
```

---

## 6. AUTENTICAÇÃO E AUTORIZAÇÃO

### 6.1 Tipos e Roles
```typescript
type UserProfile = {
  id: string;        // UUID do perfil (tabela usuarios)
  user_id: string;   // UUID do auth.users
  nome: string;
  email: string;
  tipo: "administrador" | "gerente" | "vendedor";
  ativo: boolean;
};

const ROLE_LABELS = {
  administrador: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
};
```

### 6.2 Permissões por Rota
```
/backoffice/configuracoes   → apenas administrador
/backoffice/relatorios      → administrador e gerente
/backoffice/financeiro      → todos (contas_pagar visível só admin/gerente)
/backoffice/dashboard       → todos
/backoffice/clientes        → todos
/backoffice/orcamentos      → todos (vendedor vê só os seus)
/backoffice/vendas          → todos (vendedor vê só as suas)
/backoffice/checkout        → todos
```

### 6.3 Fluxo de Login
1. `signInWithPassword` via Supabase Auth
2. Buscar perfil em `usuarios` por `user_id`
3. Verificar `ativo = true` (se false → signOut + alerta)
4. Salvar perfil em `localStorage`
5. Inserir atividade de login em `atividades`
6. Redirecionar para `/backoffice/dashboard/`

---

## 7. SITE PÚBLICO — LÓGICA DAS SEÇÕES

### 7.1 Seções e IDs
```
#hero         → SiteHero (typewriter "viva em movimento" + botão cotação)
#quem-somos   → QuemSomos (texto + imagem Unsplash)
#cotacao      → CotacaoSection (formulário → WhatsApp)
#confessional → Confessional (5 frases de missão)
#servicos     → Servicos (6 cards: Passagens, Hospedagem, Pacotes, Corporativo, Lua de Mel, Grupos)
#contato      → Contato (formulário → WhatsApp)
footer        → SiteFooter
```

### 7.2 Formulário de Cotação (WhatsApp)
**Campos:**
- Tipo de viagem: ida-volta | somente-ida | multi-destino
- Origem / Destino (autocomplete aeroportos JSON)
- Data partida / Data retorno
- Passageiros: adultos (min 1) + crianças + bebês + classe (econômica/executiva/primeira)
- Bagagem: sem | despachada (23kg) | mão
- Voos diretos: checkbox
- Nome + Telefone

**Montagem da mensagem WhatsApp:**
```
POST → https://wa.me/5511934762251?text=MENSAGEM_ENCODED
```

### 7.3 Formulário de Contato (WhatsApp)
**Campos:** Nome, Email, Telefone, Destino interesse, Mensagem

---

## 8. BACKOFFICE — LÓGICA DE CADA MÓDULO

### 8.1 Layout do Backoffice
- **Sidebar** (80px, fixo): ícones de navegação com tooltip hover
  - Dashboard, Clientes, Orçamentos, Vendas, Relatórios*, Financeiro, Checkout
  - Configurações** (no final)
  - Logout + Avatar com iniciais do usuário
- **Topbar** (66px): título da página + subtítulo + botões de ação + theme toggle
- **Conteúdo**: flex-1 com scroll

### 8.2 Dashboard
**Dados carregados em paralelo:**
1. `totalClientes` — contagem de `clientes` status=ativo (filtrado por vendedor se não admin/gerente)
2. `totalVendas` e `faturamentoTotal` — vendas do mês atual (status in confirmada,concluida)
3. `recentSales` — últimas 5 vendas com join clientes
4. `topSellers` — vendedores do mês agrupados por total (apenas admin/gerente)
5. `salesByDay` — últimos 7 dias em buckets por dia
6. `revenueByCategory` — agrupamento por `vendas.tipo`
7. `contasReceber` — pendentes
8. `contasPagar` — pendentes (admin/gerente)

**Gráficos:** Recharts (`BarChart` vendas 7 dias + `PieChart` distribuição por tipo)
**Refresh:** automático a cada 5 minutos

### 8.3 Clientes (CRUD)
**Campos:** nome, email, telefone, CPF, RG, data_nascimento, endereço, cidade, estado, CEP, observações, status
**Busca:** por nome ou email (client-side)
**Filtro:** status (ativo/inativo)
**Ações:** criar, editar, inativar, exportar PDF

### 8.4 Orçamentos (CRUD)
**Campos:** cliente (autocomplete), data, passageiros (adultos/crianças/bebês), bagagem, voos (JSONB array), valor, forma de pagamento, observações, status

**Status:** pendente → enviado → aprovado/recusado → convertido

**Voos (JSONB):**
```typescript
type Voo = {
  tipo: "ida" | "volta";
  origem: string;   // ex: "GRU - Guarulhos"
  destino: string;
  data: string;
  horario_saida: string;
  horario_chegada: string;
  companhia: string;
  numero_voo: string;
};
```

**Forma de pagamento padrão:**
```
"Em até 4x sem juros, nos cartões Amex, Diners, Elo, Hipercard, Mastercard e Visa, Pix ou transferência bancária."
```

**Exportar PDF:** jsPDF + jsPDF-autotable

### 8.5 Vendas (CRUD)
**Campos:** cliente, tipo, origem, destino, data_ida, data_volta, data_venda, valor_total, taxa_rav, taxa_du, comissao_percentual, status, forma_pagamento, observações
**Status:** pendente → confirmada → concluida / cancelada

### 8.6 Financeiro (Tabs)
- **Aba "A Receber":** CRUD contas_receber, marcar como recebido
- **Aba "A Pagar":** CRUD contas_pagar (admin/gerente), marcar como pago
- **Aba "Comissões":** lista comissoes com join usuarios/vendas, marcar como pago

### 8.7 Relatórios (admin/gerente)
- Filtros: período (data início/fim), vendedor, status
- Tabela de vendas com exportação CSV/PDF
- Gráficos de performance

### 8.8 Configurações (admin)
- CRUD de usuários do sistema
- Campos: nome, email, tipo (admin/gerente/vendedor), ativo
- Cria usuário no Supabase Auth via admin

### 8.9 Checkout AbacatePay
**Fluxo:**
1. Selecionar venda pelo ID (query string `?id=UUID`)
2. Botão "Gerar Link de Pagamento"
3. POST para Edge Function `criar-checkout-abacatepay` com JWT da sessão
4. Edge Function cria produto + checkout no AbacatePay
5. Salva `pagamentos` com `checkout_id`, `checkout_url`, `status: 'pending'`
6. Redireciona para URL do checkout (PIX ou cartão, até 6x)
7. Webhook AbacatePay atualiza `pagamentos.status` e `vendas.status`

---

## 9. EDGE FUNCTIONS (Supabase Deno)

### 9.1 `criar-checkout-abacatepay`
**Variáveis necessárias:**
```
ABACATEPAY_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SITE_URL=https://moovifly.com.br
```

**Fluxo:**
1. Recebe `{ vendaId }` via POST
2. Busca venda + cliente no banco
3. Verifica se já existe checkout (retorna URL existente se sim)
4. Cria produto dinâmico no AbacatePay (`/products/create`)
5. Cria checkout (`/checkouts/create`) com PIX + CARD, até 6 parcelas
6. Salva na tabela `pagamentos`
7. Retorna `{ checkoutUrl, checkoutId }`

### 9.2 `webhook-abacatepay`
**Fluxo:**
1. Valida assinatura HMAC
2. Evento `BILLING_PAID` → atualiza `pagamentos.status = 'paid'` + `vendas.status = 'confirmada'`
3. Evento `BILLING_CANCELLED` → atualiza `status = 'cancelled'` em ambas as tabelas

---

## 10. UTILITÁRIOS

### 10.1 `lib/format.ts`
```typescript
formatCurrency(value)      // R$ 1.234,56
formatDate(date)           // DD/MM/YYYY
formatDateTime(date)       // DD/MM/YYYY HH:MM
formatPercent(value)       // 12,50%
formatPhoneBR(phone)       // (11) 99999-9999
formatCpfCnpj(value)       // 000.000.000-00 ou 00.000.000/0000-00
getInitials(name)          // "João Silva" → "JS"
```

### 10.2 `lib/datasets.ts`
- `loadAeroportos()` — carrega `/data/aeroportos.json` com cache
- `loadCompanhias()` — carrega `/data/companhias-aereas.json` com cache
- `searchAeroportos(query, list)` — busca por código, nome, cidade, país
- `searchCompanhias(query, list)` — busca por código, nome, país, ICAO

### 10.3 `components/autocomplete.tsx`
Componente de busca com dropdown, props:
```typescript
{
  value: string;
  onValueChange: (text: string) => void;
  onSelect: (option: { value: unknown; label: string; description?: string }) => void;
  options: { value: unknown; label: string; description?: string }[];
  placeholder?: string;
  inputId?: string;
}
```

### 10.4 `components/confirm-modal.tsx`
Modal de confirmação imperativo:
```typescript
await showConfirm({
  title: string;
  message: string;
  confirmText?: string;  // default: "Confirmar"
  cancelText?: string;   // default: "Cancelar"
  destructive?: boolean; // botão vermelho
})
// retorna: true | false
```

---

## 11. COMPONENTES UI (shadcn-like)

Todos em `components/ui/`:
- `button.tsx` — variantes: default, ghost, outline, destructive; sizes: default, sm, icon
- `card.tsx` — Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription
- `input.tsx` — Input com border/focus via CSS vars
- `label.tsx` — Label
- `select.tsx` — Select nativo estilizado
- `textarea.tsx` — Textarea
- `table.tsx` — Table, TableHeader, TableBody, TableHead, TableRow, TableCell
- `dialog.tsx` — Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
- `tabs.tsx` — Tabs, TabsList, TabsTrigger, TabsContent
- `badge.tsx` — Badge com variantes: default, success, warning, info, destructive
- `avatar.tsx` — Avatar, AvatarFallback
- `skeleton.tsx` — Skeleton (pulse animation)
- `separator.tsx` — Separator
- `sonner.tsx` — Toaster (re-export sonner)

---

## 12. IMAGENS E ASSETS

**Assets necessários no `public/assets/images/`:**
1. `HERO_SITE.png` — foto de hero (avião ou destino turístico)
2. `moovifly_logo_branco.png` — logo branco para fundo escuro (140x36px aprox)

**`public/favicon.png`** — ícone 40x40px

**`public/data/`** (manter exatamente):
- `aeroportos.json` — array de objetos: `{ codigo, nome, cidade, estado?, pais }`
- `companhias-aereas.json` — array: `{ codigo, nome, pais, icao?, aliance? }`

---

## 13. NAVIGATION (Sidebar)

```typescript
const NAV_ITEMS = [
  { href: "/backoffice/dashboard/", label: "Dashboard", icon: LayoutGrid },
  { href: "/backoffice/clientes/", label: "Clientes", icon: Users },
  { href: "/backoffice/orcamentos/", label: "Orçamentos", icon: FileText },
  { href: "/backoffice/vendas/", label: "Vendas", icon: ShoppingCart },
  { href: "/backoffice/relatorios/", label: "Relatórios", icon: BarChart3, roles: ["administrador", "gerente"] },
  { href: "/backoffice/financeiro/", label: "Financeiro", icon: Wallet },
  { href: "/backoffice/checkout/", label: "Checkout", icon: CreditCard },
];

const SECONDARY_ITEMS = [
  { href: "/backoffice/configuracoes/", label: "Configurações", icon: Settings, roles: ["administrador"] },
];
```

---

## 14. CONFIGURAÇÕES DO SUPABASE (projeto atual)

```
Project URL: https://axrkvvjnubjxgejvrbmf.supabase.co
Publishable Key: sb_publishable_p12DlauhX8MfP617h5eD7g_RsnbKVwn
Project Reference: axrkvvjnubjxgejvrbmf
```

---

## 15. GUIA DE RECRIAÇÃO DO ZERO

### Passo 1: Inicializar o projeto Next.js
```bash
npx create-next-app@latest moovifly --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
cd moovifly
```

### Passo 2: Instalar dependências
```bash
npm install @supabase/supabase-js @supabase/ssr next-themes lucide-react sonner recharts jspdf jspdf-autotable clsx tailwind-merge class-variance-authority
npm install -D tw-animate-css
```

### Passo 3: Configurar variáveis de ambiente
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://axrkvvjnubjxgejvrbmf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_p12DlauhX8MfP617h5eD7g_RsnbKVwn
```

### Passo 4: Aplicar schema no Supabase
- Acessar SQL Editor no projeto Supabase
- Executar o SQL da Seção 5 (Schema Completo)

### Passo 5: Deploy para Vercel
- Conectar repositório GitHub
- Adicionar variáveis de ambiente no painel Vercel
- Deploy automático no push

### Passo 6: Configurar domínio na Hostinger
- Adicionar domínio customizado na Vercel
- Configurar DNS na Hostinger (CNAME para cname.vercel-dns.com)

### Passo 7: Deploy das Edge Functions
```bash
supabase functions deploy criar-checkout-abacatepay
supabase functions deploy webhook-abacatepay
```

---

*Documento gerado em 01/05/2026 — MooviFly v2.0*
