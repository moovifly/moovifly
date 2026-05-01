-- ============================================================
-- MooviFly — Schema inicial completo
-- ============================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfis de usuário (vinculados ao auth.users do Supabase)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'vendedor' CHECK (tipo IN ('administrador', 'gerente', 'vendedor')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  observacoes TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orçamentos
CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_orcamento TEXT UNIQUE,
  cliente_id UUID REFERENCES clientes(id),
  usuario_id UUID REFERENCES usuarios(id),
  destino TEXT,
  origem TEXT,
  data_ida DATE,
  data_volta DATE,
  passageiros INTEGER DEFAULT 1,
  companhia TEXT,
  classe TEXT DEFAULT 'economica',
  valor_total NUMERIC(10,2) DEFAULT 0,
  taxa_rav NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'enviado', 'aprovado', 'recusado', 'expirado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendas
CREATE TABLE IF NOT EXISTS vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_venda TEXT UNIQUE,
  orcamento_id UUID REFERENCES orcamentos(id),
  cliente_id UUID REFERENCES clientes(id),
  usuario_id UUID REFERENCES usuarios(id),
  destino TEXT,
  origem TEXT,
  data_ida DATE,
  data_volta DATE,
  passageiros INTEGER DEFAULT 1,
  companhia TEXT,
  classe TEXT DEFAULT 'economica',
  valor_total NUMERIC(10,2) DEFAULT 0,
  taxa_rav NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'concluida', 'cancelada')),
  forma_pagamento TEXT,
  observacoes TEXT,
  data_venda DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contas a receber
CREATE TABLE IF NOT EXISTS contas_receber (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID REFERENCES vendas(id),
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'parcial', 'cancelado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contas a pagar
CREATE TABLE IF NOT EXISTS contas_pagar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'parcial', 'cancelado')),
  categoria TEXT DEFAULT 'operacional',
  fornecedor TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comissões
CREATE TABLE IF NOT EXISTS comissoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID REFERENCES vendas(id),
  usuario_id UUID REFERENCES usuarios(id),
  valor NUMERIC(10,2) NOT NULL,
  percentual NUMERIC(5,2) DEFAULT 5.0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagamentos / checkout AbacatePay
CREATE TABLE IF NOT EXISTS pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id UUID REFERENCES vendas(id),
  billing_id TEXT,
  produto_id TEXT,
  valor NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'expirado', 'cancelado')),
  checkout_url TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de atividades
CREATE TABLE IF NOT EXISTS atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS — updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orcamentos_updated_at BEFORE UPDATE ON orcamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vendas_updated_at BEFORE UPDATE ON vendas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contas_receber_updated_at BEFORE UPDATE ON contas_receber FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contas_pagar_updated_at BEFORE UPDATE ON contas_pagar FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_comissoes_updated_at BEFORE UPDATE ON comissoes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pagamentos_updated_at BEFORE UPDATE ON pagamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGERS — numeração automática
-- ============================================================

CREATE OR REPLACE FUNCTION gerar_numero_orcamento()
RETURNS TRIGGER AS $$
DECLARE
  seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_orcamento FROM 4) AS INT)), 0) + 1
    INTO seq FROM orcamentos WHERE numero_orcamento ~ '^ORC';
  NEW.numero_orcamento := 'ORC' || LPAD(seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gerar_numero_orcamento
  BEFORE INSERT ON orcamentos
  FOR EACH ROW
  WHEN (NEW.numero_orcamento IS NULL)
  EXECUTE FUNCTION gerar_numero_orcamento();

CREATE OR REPLACE FUNCTION gerar_numero_venda()
RETURNS TRIGGER AS $$
DECLARE
  seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_venda FROM 4) AS INT)), 0) + 1
    INTO seq FROM vendas WHERE numero_venda ~ '^VDA';
  NEW.numero_venda := 'VDA' || LPAD(seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gerar_numero_venda
  BEFORE INSERT ON vendas
  FOR EACH ROW
  WHEN (NEW.numero_venda IS NULL)
  EXECUTE FUNCTION gerar_numero_venda();

-- ============================================================
-- TRIGGER — criar comissão ao confirmar venda
-- ============================================================

CREATE OR REPLACE FUNCTION criar_comissao_on_venda()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('confirmada', 'concluida') AND OLD.status = 'pendente' THEN
    IF NOT EXISTS (SELECT 1 FROM comissoes WHERE venda_id = NEW.id) THEN
      INSERT INTO comissoes (venda_id, usuario_id, valor, percentual, status)
      VALUES (NEW.id, NEW.usuario_id, ROUND(NEW.taxa_rav * 0.05, 2), 5.0, 'pendente');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_criar_comissao
  AFTER UPDATE ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION criar_comissao_on_venda();

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar tipo de usuário
CREATE OR REPLACE FUNCTION get_user_tipo()
RETURNS TEXT AS $$
  SELECT tipo FROM usuarios WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Usuários: cada um vê o próprio perfil; admins/gerentes veem todos
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT USING (
  user_id = auth.uid() OR get_user_tipo() IN ('administrador', 'gerente')
);
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE USING (
  user_id = auth.uid() OR get_user_tipo() = 'administrador'
);
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT WITH CHECK (get_user_tipo() = 'administrador');

-- Clientes: todos os usuários autenticados
CREATE POLICY "clientes_all" ON clientes FOR ALL USING (auth.role() = 'authenticated');

-- Orçamentos: vendedor vê apenas os seus; gerentes/admins veem todos
CREATE POLICY "orcamentos_select" ON orcamentos FOR SELECT USING (
  usuario_id IN (SELECT id FROM usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);
CREATE POLICY "orcamentos_insert" ON orcamentos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "orcamentos_update" ON orcamentos FOR UPDATE USING (
  usuario_id IN (SELECT id FROM usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);

-- Vendas: mesmo padrão que orçamentos
CREATE POLICY "vendas_select" ON vendas FOR SELECT USING (
  usuario_id IN (SELECT id FROM usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);
CREATE POLICY "vendas_insert" ON vendas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "vendas_update" ON vendas FOR UPDATE USING (
  usuario_id IN (SELECT id FROM usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);

-- Financeiro: apenas gerentes e admins
CREATE POLICY "contas_receber_all" ON contas_receber FOR ALL USING (
  get_user_tipo() IN ('administrador', 'gerente')
);
CREATE POLICY "contas_pagar_all" ON contas_pagar FOR ALL USING (
  get_user_tipo() IN ('administrador', 'gerente')
);

-- Comissões: vendedor vê as suas; gerentes/admins veem todas
CREATE POLICY "comissoes_select" ON comissoes FOR SELECT USING (
  usuario_id IN (SELECT id FROM usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);
CREATE POLICY "comissoes_update" ON comissoes FOR UPDATE USING (
  get_user_tipo() IN ('administrador', 'gerente')
);

-- Pagamentos: autenticados
CREATE POLICY "pagamentos_all" ON pagamentos FOR ALL USING (auth.role() = 'authenticated');

-- Atividades: cada um vê as suas; admins veem todas
CREATE POLICY "atividades_select" ON atividades FOR SELECT USING (
  usuario_id IN (SELECT id FROM usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() = 'administrador'
);
CREATE POLICY "atividades_insert" ON atividades FOR INSERT WITH CHECK (auth.role() = 'authenticated');
