-- Ajusta trigger de criação de comissão ao schema atual e libera INSERT/DELETE para admins/gerentes.

-- Trigger: cria comissão quando a venda é confirmada/concluída
CREATE OR REPLACE FUNCTION public.criar_comissao_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_percentual NUMERIC(5,2);
  v_base       NUMERIC(10,2);
  v_valor      NUMERIC(10,2);
BEGIN
  IF NEW.status IN ('confirmada', 'concluida') AND OLD.status = 'pendente' THEN
    IF NOT EXISTS (SELECT 1 FROM public.comissoes WHERE venda_id = NEW.id) THEN
      SELECT comissao_percentual INTO v_percentual
      FROM public.usuarios
      WHERE id = NEW.vendedor_id;

      v_base := COALESCE(NEW.taxa_rav, 0) + COALESCE(NEW.taxa_du, 0);
      v_valor := ROUND(v_base * COALESCE(v_percentual, 0) / 100, 2);

      INSERT INTO public.comissoes (
        venda_id,
        vendedor_id,
        valor_venda,
        base_calculo,
        percentual_comissao,
        valor_comissao,
        status
      )
      VALUES (
        NEW.id,
        NEW.vendedor_id,
        COALESCE(NEW.valor_total, 0),
        v_base,
        COALESCE(v_percentual, 0),
        v_valor,
        'pendente'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- RLS: permitir criação/remoção manual por admins/gerentes
DROP POLICY IF EXISTS "comissoes_insert" ON public.comissoes;
CREATE POLICY "comissoes_insert" ON public.comissoes
FOR INSERT
WITH CHECK (get_user_tipo() IN ('administrador', 'gerente'));

DROP POLICY IF EXISTS "comissoes_delete" ON public.comissoes;
CREATE POLICY "comissoes_delete" ON public.comissoes
FOR DELETE
USING (get_user_tipo() IN ('administrador', 'gerente'));

