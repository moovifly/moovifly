-- Gerar venda a partir do orçamento: payload envia passageiros, companhia, orcamento_id.
-- Bancos criados só com parte do schema podem não ter essas colunas (PGRST / schema cache).

ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS passageiros INTEGER DEFAULT 1;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS companhia TEXT;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS classe TEXT DEFAULT 'economica';
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS orcamento_id UUID REFERENCES public.orcamentos(id);
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS data_venda DATE DEFAULT CURRENT_DATE;

COMMENT ON COLUMN public.vendas.passageiros IS 'Total de passageiros (PAX)';
COMMENT ON COLUMN public.vendas.companhia IS 'Companhia aérea (trecho principal)';
COMMENT ON COLUMN public.vendas.orcamento_id IS 'Orçamento de origem, se houver';
