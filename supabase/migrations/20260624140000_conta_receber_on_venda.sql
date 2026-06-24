-- Cria conta a receber automaticamente quando a venda é confirmada ou concluída.
-- Inclui backfill das vendas existentes sem lançamento.

CREATE OR REPLACE FUNCTION public.criar_conta_receber_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('confirmada', 'concluida') AND
     (TG_OP = 'INSERT' OR OLD.status NOT IN ('confirmada', 'concluida')) THEN
    IF NOT EXISTS (SELECT 1 FROM public.contas_receber WHERE venda_id = NEW.id) THEN
      INSERT INTO public.contas_receber (
        venda_id,
        cliente_id,
        descricao,
        valor,
        data_vencimento,
        forma_pagamento,
        status
      ) VALUES (
        NEW.id,
        NEW.cliente_id,
        COALESCE(
          CASE WHEN NEW.numero_venda IS NOT NULL AND btrim(NEW.numero_venda) <> ''
            THEN 'Venda ' || NEW.numero_venda
            ELSE NULL
          END,
          NULLIF(btrim(NEW.descricao), ''),
          'Venda'
        ),
        COALESCE(NEW.valor_total, 0),
        COALESCE(NEW.data_vencimento_pagamento, NEW.data_venda, CURRENT_DATE),
        NEW.forma_pagamento,
        'pendente'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_conta_receber ON public.vendas;
CREATE TRIGGER trg_criar_conta_receber
  AFTER INSERT OR UPDATE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_conta_receber_on_venda();

-- Backfill: vendas confirmadas/concluídas sem conta a receber
INSERT INTO public.contas_receber (
  venda_id,
  cliente_id,
  descricao,
  valor,
  data_vencimento,
  forma_pagamento,
  status
)
SELECT
  v.id,
  v.cliente_id,
  COALESCE(
    CASE WHEN v.numero_venda IS NOT NULL AND btrim(v.numero_venda) <> ''
      THEN 'Venda ' || v.numero_venda
      ELSE NULL
    END,
    NULLIF(btrim(v.descricao), ''),
    'Venda'
  ),
  COALESCE(v.valor_total, 0),
  COALESCE(v.data_vencimento_pagamento, v.data_venda, CURRENT_DATE),
  v.forma_pagamento,
  'pendente'
FROM public.vendas v
WHERE v.status IN ('confirmada', 'concluida')
  AND NOT EXISTS (
    SELECT 1 FROM public.contas_receber cr WHERE cr.venda_id = v.id
  );
