-- Integração Conta Simples: estrutura de sync, eventos e conciliação.

-- 1) Extensões/colunas de pagamentos para múltiplos provedores
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

UPDATE public.pagamentos
SET provider = 'abacatepay'
WHERE provider IS NULL;

ALTER TABLE public.pagamentos
  ALTER COLUMN provider SET DEFAULT 'abacatepay',
  ALTER COLUMN provider SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pagamentos_provider_check'
      AND conrelid = 'public.pagamentos'::regclass
  ) THEN
    ALTER TABLE public.pagamentos
      ADD CONSTRAINT pagamentos_provider_check
      CHECK (provider IN ('abacatepay', 'conta_simples'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_provider_external_id_idx
  ON public.pagamentos (provider, external_id)
  WHERE external_id IS NOT NULL;

-- 2) Tabelas Conta Simples
CREATE TABLE IF NOT EXISTS public.conta_simples_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,
  company_id TEXT,
  name TEXT NOT NULL,
  category_type TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conta_simples_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,
  company_id TEXT,
  name TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conta_simples_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'conta_simples',
  external_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  description TEXT,
  amount_brl NUMERIC(14,2) NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  transaction_status TEXT NOT NULL DEFAULT 'pendente',
  category_external_id TEXT,
  category_name TEXT,
  cost_center_external_id TEXT,
  cost_center_name TEXT,
  request_id TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conta_simples_transactions_provider_check
    CHECK (provider IN ('conta_simples')),
  CONSTRAINT conta_simples_transactions_provider_external_id_key
    UNIQUE (provider, external_id)
);

CREATE TABLE IF NOT EXISTS public.integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  request_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT integration_events_provider_event_id_key UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS public.finance_conciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_simples_transaction_id UUID NOT NULL
    REFERENCES public.conta_simples_transactions(id) ON DELETE CASCADE,
  contas_pagar_id UUID REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  contas_receber_id UUID REFERENCES public.contas_receber(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'conciliada', 'divergente')),
  match_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  reason TEXT,
  matched_at TIMESTAMPTZ,
  reviewer_user_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_conciliations_single_target_check
    CHECK (num_nonnulls(contas_pagar_id, contas_receber_id) <= 1),
  CONSTRAINT finance_conciliations_transaction_unique
    UNIQUE (conta_simples_transaction_id)
);

-- 3) Índices
CREATE INDEX IF NOT EXISTS conta_simples_transactions_transaction_date_idx
  ON public.conta_simples_transactions (transaction_date DESC);

CREATE INDEX IF NOT EXISTS conta_simples_transactions_status_idx
  ON public.conta_simples_transactions (transaction_status);

CREATE INDEX IF NOT EXISTS conta_simples_transactions_synced_at_idx
  ON public.conta_simples_transactions (synced_at DESC);

CREATE INDEX IF NOT EXISTS conta_simples_transactions_category_idx
  ON public.conta_simples_transactions (category_name);

CREATE INDEX IF NOT EXISTS conta_simples_transactions_cost_center_idx
  ON public.conta_simples_transactions (cost_center_name);

CREATE INDEX IF NOT EXISTS integration_events_provider_status_idx
  ON public.integration_events (provider, status, received_at DESC);

CREATE INDEX IF NOT EXISTS finance_conciliations_status_idx
  ON public.finance_conciliations (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS finance_conciliations_contas_pagar_idx
  ON public.finance_conciliations (contas_pagar_id)
  WHERE contas_pagar_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS finance_conciliations_contas_receber_idx
  ON public.finance_conciliations (contas_receber_id)
  WHERE contas_receber_id IS NOT NULL;

-- 4) Trigger de updated_at nas novas tabelas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conta_simples_categories_updated_at'
  ) THEN
    CREATE TRIGGER trg_conta_simples_categories_updated_at
      BEFORE UPDATE ON public.conta_simples_categories
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conta_simples_cost_centers_updated_at'
  ) THEN
    CREATE TRIGGER trg_conta_simples_cost_centers_updated_at
      BEFORE UPDATE ON public.conta_simples_cost_centers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conta_simples_transactions_updated_at'
  ) THEN
    CREATE TRIGGER trg_conta_simples_transactions_updated_at
      BEFORE UPDATE ON public.conta_simples_transactions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_integration_events_updated_at'
  ) THEN
    CREATE TRIGGER trg_integration_events_updated_at
      BEFORE UPDATE ON public.integration_events
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_finance_conciliations_updated_at'
  ) THEN
    CREATE TRIGGER trg_finance_conciliations_updated_at
      BEFORE UPDATE ON public.finance_conciliations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END
$$;

-- 5) RLS
ALTER TABLE public.conta_simples_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_simples_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_simples_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_conciliations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_finance_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.get_user_tipo() IN ('administrador', 'gerente'), FALSE);
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conta_simples_categories'
      AND policyname = 'conta_simples_categories_manager_all'
  ) THEN
    CREATE POLICY conta_simples_categories_manager_all
      ON public.conta_simples_categories
      FOR ALL
      USING (public.is_finance_manager())
      WITH CHECK (public.is_finance_manager());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conta_simples_cost_centers'
      AND policyname = 'conta_simples_cost_centers_manager_all'
  ) THEN
    CREATE POLICY conta_simples_cost_centers_manager_all
      ON public.conta_simples_cost_centers
      FOR ALL
      USING (public.is_finance_manager())
      WITH CHECK (public.is_finance_manager());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conta_simples_transactions'
      AND policyname = 'conta_simples_transactions_manager_all'
  ) THEN
    CREATE POLICY conta_simples_transactions_manager_all
      ON public.conta_simples_transactions
      FOR ALL
      USING (public.is_finance_manager())
      WITH CHECK (public.is_finance_manager());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'integration_events'
      AND policyname = 'integration_events_manager_all'
  ) THEN
    CREATE POLICY integration_events_manager_all
      ON public.integration_events
      FOR ALL
      USING (public.is_finance_manager())
      WITH CHECK (public.is_finance_manager());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'finance_conciliations'
      AND policyname = 'finance_conciliations_manager_all'
  ) THEN
    CREATE POLICY finance_conciliations_manager_all
      ON public.finance_conciliations
      FOR ALL
      USING (public.is_finance_manager())
      WITH CHECK (public.is_finance_manager());
  END IF;
END
$$;

-- 6) Conciliação automática
CREATE OR REPLACE FUNCTION public.reconcile_conta_simples_transaction(p_transaction_id UUID)
RETURNS public.finance_conciliations
LANGUAGE plpgsql
AS $$
DECLARE
  v_tx public.conta_simples_transactions;
  v_pagar_id UUID;
  v_receber_id UUID;
  v_pagar_count INTEGER := 0;
  v_receber_count INTEGER := 0;
  v_status TEXT := 'pendente';
  v_reason TEXT := 'Sem correspondência automática.';
  v_score NUMERIC(5,2) := 0;
  v_result public.finance_conciliations;
BEGIN
  SELECT * INTO v_tx
  FROM public.conta_simples_transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação % não encontrada', p_transaction_id;
  END IF;

  SELECT id, COUNT(*) OVER()
  INTO v_pagar_id, v_pagar_count
  FROM public.contas_pagar
  WHERE ABS((valor - v_tx.amount_brl)::NUMERIC) <= 0.01
    AND status IN ('pendente', 'parcial', 'pago')
    AND COALESCE(data_pagamento, data_vencimento) BETWEEN (v_tx.transaction_date::DATE - 3) AND (v_tx.transaction_date::DATE + 3)
  ORDER BY ABS((valor - v_tx.amount_brl)::NUMERIC), ABS(COALESCE(data_pagamento, data_vencimento) - v_tx.transaction_date::DATE)
  LIMIT 1;

  IF v_pagar_count IS NULL THEN
    v_pagar_count := 0;
  END IF;

  SELECT id, COUNT(*) OVER()
  INTO v_receber_id, v_receber_count
  FROM public.contas_receber
  WHERE ABS((valor - v_tx.amount_brl)::NUMERIC) <= 0.01
    AND status IN ('pendente', 'parcial', 'pago', 'recebido')
    AND COALESCE(data_pagamento, data_vencimento) BETWEEN (v_tx.transaction_date::DATE - 3) AND (v_tx.transaction_date::DATE + 3)
  ORDER BY ABS((valor - v_tx.amount_brl)::NUMERIC), ABS(COALESCE(data_pagamento, data_vencimento) - v_tx.transaction_date::DATE)
  LIMIT 1;

  IF v_receber_count IS NULL THEN
    v_receber_count := 0;
  END IF;

  IF v_pagar_count = 1 AND v_receber_count = 0 THEN
    v_status := 'conciliada';
    v_reason := 'Match automático com conta a pagar.';
    v_score := 100;
  ELSIF v_receber_count = 1 AND v_pagar_count = 0 THEN
    v_status := 'conciliada';
    v_reason := 'Match automático com conta a receber.';
    v_score := 100;
  ELSIF v_pagar_count = 0 AND v_receber_count = 0 THEN
    v_status := 'pendente';
    v_reason := 'Nenhum match automático encontrado.';
    v_score := 0;
  ELSE
    v_status := 'divergente';
    v_reason := 'Múltiplas possibilidades de match.';
    v_score := 10;
  END IF;

  INSERT INTO public.finance_conciliations (
    conta_simples_transaction_id,
    contas_pagar_id,
    contas_receber_id,
    status,
    match_score,
    reason,
    matched_at
  )
  VALUES (
    v_tx.id,
    CASE WHEN v_status = 'conciliada' THEN v_pagar_id ELSE NULL END,
    CASE WHEN v_status = 'conciliada' THEN v_receber_id ELSE NULL END,
    v_status,
    v_score,
    v_reason,
    CASE WHEN v_status = 'conciliada' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (conta_simples_transaction_id)
  DO UPDATE SET
    contas_pagar_id = EXCLUDED.contas_pagar_id,
    contas_receber_id = EXCLUDED.contas_receber_id,
    status = EXCLUDED.status,
    match_score = EXCLUDED.match_score,
    reason = EXCLUDED.reason,
    matched_at = EXCLUDED.matched_at,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_conta_simples_pending(p_limit INTEGER DEFAULT 200)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_row RECORD;
  v_total INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT t.id
    FROM public.conta_simples_transactions t
    LEFT JOIN public.finance_conciliations fc
      ON fc.conta_simples_transaction_id = t.id
    WHERE fc.id IS NULL OR fc.status <> 'conciliada'
    ORDER BY t.transaction_date DESC
    LIMIT GREATEST(COALESCE(p_limit, 200), 1)
  LOOP
    PERFORM public.reconcile_conta_simples_transaction(v_row.id);
    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;
