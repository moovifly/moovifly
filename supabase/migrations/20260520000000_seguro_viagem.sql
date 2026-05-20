-- Adiciona suporte a Seguro Viagem no módulo de vendas

-- Coluna para diferenciar Aéreo de Seguro Viagem
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS categoria_venda TEXT DEFAULT 'aereo'
    CHECK (categoria_venda IN ('aereo', 'seguro_viagem'));

-- Campo de voucher para Seguro Viagem
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS voucher TEXT;

-- Atualiza trigger: Seguro Viagem usa 40% fixo sobre valor_total
CREATE OR REPLACE FUNCTION public.criar_comissao_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_percentual       NUMERIC(5,2);
  v_percentual_usado NUMERIC(5,2);
  v_base             NUMERIC(10,2);
  v_valor            NUMERIC(10,2);
BEGIN
  IF NEW.status IN ('confirmada', 'concluida') AND OLD.status = 'pendente' THEN
    IF NOT EXISTS (SELECT 1 FROM public.comissoes WHERE venda_id = NEW.id) THEN

      IF NEW.categoria_venda = 'seguro_viagem' THEN
        -- Comissão fixa de 40% sobre o valor total
        v_percentual_usado := 40;
        v_base  := COALESCE(NEW.valor_total, 0);
        v_valor := ROUND(v_base * 40 / 100, 2);
      ELSE
        -- Aéreo: percentual do vendedor sobre (taxa_rav + taxa_du)
        SELECT comissao_percentual INTO v_percentual
          FROM public.usuarios
         WHERE id = NEW.vendedor_id;

        v_base             := COALESCE(NEW.taxa_rav, 0) + COALESCE(NEW.taxa_du, 0);
        v_percentual_usado := COALESCE(v_percentual, 0);
        v_valor            := ROUND(v_base * v_percentual_usado / 100, 2);
      END IF;

      INSERT INTO public.comissoes (
        venda_id,
        vendedor_id,
        valor_venda,
        base_calculo,
        percentual_comissao,
        valor_comissao,
        status
      ) VALUES (
        NEW.id,
        NEW.vendedor_id,
        COALESCE(NEW.valor_total, 0),
        v_base,
        v_percentual_usado,
        v_valor,
        'pendente'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
