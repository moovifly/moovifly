-- Datas de ida/volta usadas pelo formulário de vendas (evita PGRST204 no PATCH).
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS data_ida DATE;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS data_volta DATE;

COMMENT ON COLUMN public.vendas.data_ida IS 'Data de ida da viagem';
COMMENT ON COLUMN public.vendas.data_volta IS 'Data de volta da viagem';
