-- Localizador (LOC) da reserva aérea, preenchido pelo vendedor no cadastro da venda.
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS localizador TEXT;

COMMENT ON COLUMN public.vendas.localizador IS 'Localizador (LOC) da reserva aérea';
