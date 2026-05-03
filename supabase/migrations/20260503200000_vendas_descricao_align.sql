-- Alinha vendas.descricao ao app: coluna resumo (opcional no banco; o front sempre preenche ao criar).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendas' AND column_name = 'descricao'
  ) THEN
    ALTER TABLE public.vendas ADD COLUMN descricao TEXT;
  END IF;
END $$;

ALTER TABLE public.vendas ALTER COLUMN descricao DROP NOT NULL;

COMMENT ON COLUMN public.vendas.descricao IS 'Resumo curto da venda (ex.: tipo e rota)';
