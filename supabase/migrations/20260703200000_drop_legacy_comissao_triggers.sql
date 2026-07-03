-- Remove triggers legados que duplicavam contas a pagar de comissão
-- (gerar_comissao_venda_concluida + sincronizar_pagamento_comissao).

-- 1) Limpar duplicatas: manter lançamento do trigger novo (sem "Base: R$ ...")
DELETE FROM public.contas_pagar cp_old
WHERE cp_old.comissao_id IS NOT NULL
  AND cp_old.descricao LIKE '% - Base: R$ %'
  AND EXISTS (
    SELECT 1
    FROM public.contas_pagar cp_new
    WHERE cp_new.comissao_id = cp_old.comissao_id
      AND cp_new.id <> cp_old.id
      AND cp_new.descricao NOT LIKE '% - Base: R$ %'
  );

-- Fallback: se ainda houver mais de uma conta por comissão, manter a mais antiga
DELETE FROM public.contas_pagar cp_dup
WHERE cp_dup.comissao_id IS NOT NULL
  AND cp_dup.id <> (
    SELECT cp_keep.id
    FROM public.contas_pagar cp_keep
    WHERE cp_keep.comissao_id = cp_dup.comissao_id
    ORDER BY cp_keep.created_at ASC, cp_keep.id ASC
    LIMIT 1
  );

-- 2) Alinhar valor pendente com a comissão vinculada
UPDATE public.contas_pagar cp
SET valor = c.valor_comissao
FROM public.comissoes c
WHERE cp.comissao_id = c.id
  AND cp.status = 'pendente'
  AND cp.valor IS DISTINCT FROM c.valor_comissao;

-- 3) Remover triggers e funções legadas
DROP TRIGGER IF EXISTS trigger_gerar_comissao ON public.vendas;
DROP FUNCTION IF EXISTS public.gerar_comissao_venda_concluida();

DROP TRIGGER IF EXISTS trigger_sincronizar_pagamento_comissao ON public.contas_pagar;
DROP FUNCTION IF EXISTS public.sincronizar_pagamento_comissao();

-- 4) Impedir novas duplicatas por comissão
CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_pagar_comissao_id_unique
  ON public.contas_pagar (comissao_id)
  WHERE comissao_id IS NOT NULL;
