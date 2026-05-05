-- Ao excluir um orçamento, a venda gerada permanece; só remove o vínculo (evita erro de FK).
ALTER TABLE public.vendas
  DROP CONSTRAINT IF EXISTS vendas_orcamento_id_fkey;

ALTER TABLE public.vendas
  ADD CONSTRAINT vendas_orcamento_id_fkey
  FOREIGN KEY (orcamento_id)
  REFERENCES public.orcamentos(id)
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT vendas_orcamento_id_fkey ON public.vendas IS
  'Excluir orçamento zera orcamento_id nas vendas ligadas (histórico da venda mantido).';
