-- Coluna esperada pelo dashboard e pelo formulário de vendas; PostgREST retornava 400 ao pedir "tipo".
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS tipo text;
COMMENT ON COLUMN public.vendas.tipo IS 'Categoria comercial (passagem, pacote, hospedagem, …)';
