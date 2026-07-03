-- Backfill vendas.voos a partir do orçamento vinculado (fonte mais confiável)
UPDATE public.vendas v
SET voos = o.voos
FROM public.orcamentos o
WHERE v.orcamento_id = o.id
  AND jsonb_array_length(COALESCE(o.voos, '[]'::jsonb)) > 0
  AND jsonb_array_length(COALESCE(v.voos, '[]'::jsonb)) = 0;
