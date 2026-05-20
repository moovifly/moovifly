-- Campo fornecedor no formulário de vendas (aéreo).
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS fornecedor TEXT;

COMMENT ON COLUMN public.vendas.fornecedor IS 'Fornecedor da passagem (ex.: consolidadora ou operadora)';
