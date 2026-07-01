-- Contas bancárias / caixa e vínculo com lançamentos financeiros (fluxo de caixa por conta).

CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  banco TEXT,
  tipo_conta TEXT NOT NULL DEFAULT 'corrente'
    CHECK (tipo_conta IN ('corrente', 'poupanca', 'caixa', 'digital')),
  agencia TEXT,
  numero_conta TEXT,
  chave_pix TEXT,
  saldo_inicial NUMERIC(10, 2) NOT NULL DEFAULT 0,
  data_saldo_inicial DATE NOT NULL DEFAULT CURRENT_DATE,
  cor TEXT NOT NULL DEFAULT '#6B7280',
  principal BOOLEAN NOT NULL DEFAULT false,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_bancarias_single_principal
  ON public.contas_bancarias (principal)
  WHERE principal = true;

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID
    REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID
    REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID
    REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_receber_conta_bancaria
  ON public.contas_receber (conta_bancaria_id)
  WHERE conta_bancaria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_conta_bancaria
  ON public.contas_pagar (conta_bancaria_id)
  WHERE conta_bancaria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_receber_data_recebimento
  ON public.contas_receber (data_recebimento)
  WHERE data_recebimento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_pagamento
  ON public.contas_pagar (data_pagamento)
  WHERE data_pagamento IS NOT NULL;

CREATE TRIGGER trg_contas_bancarias_updated_at
  BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contas_bancarias_all" ON public.contas_bancarias
  FOR ALL USING (public.get_user_tipo() IN ('administrador', 'gerente'));
