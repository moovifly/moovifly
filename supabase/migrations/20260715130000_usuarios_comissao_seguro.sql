-- Adiciona campo de comissão separado para seguro viagem em cada vendedor
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS comissao_seguro_percentual NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Atualiza trigger de criação de comissão para usar comissao_seguro_percentual do vendedor
CREATE OR REPLACE FUNCTION public.criar_comissao_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_percentual       NUMERIC(5,2);
  v_percentual_usado NUMERIC(5,2);
  v_base             NUMERIC(10,2);
  v_taxa_cartao_pct  NUMERIC(6,4);
  v_taxa_cartao_val  NUMERIC(10,2);
  v_valor            NUMERIC(10,2);
BEGIN
  IF NEW.status IN ('confirmada', 'concluida') AND
     (TG_OP = 'INSERT' OR OLD.status = 'pendente') THEN
    IF NOT EXISTS (SELECT 1 FROM public.comissoes WHERE venda_id = NEW.id) THEN

      IF NEW.categoria_venda = 'seguro_viagem' THEN
        v_base := ROUND(COALESCE(NEW.valor_total, 0) * 40 / 100, 2);

        SELECT comissao_seguro_percentual INTO v_percentual
          FROM public.usuarios
         WHERE id = NEW.vendedor_id;

        v_percentual_usado := COALESCE(v_percentual, 0);
        v_valor := ROUND(v_base * v_percentual_usado / 100, 2);
      ELSE
        SELECT comissao_percentual INTO v_percentual
          FROM public.usuarios
         WHERE id = NEW.vendedor_id;

        v_base             := COALESCE(NEW.taxa_rav, 0) + COALESCE(NEW.taxa_du, 0);
        v_percentual_usado := COALESCE(v_percentual, 0);

        IF NEW.forma_pagamento IN ('1x Cartão de Crédito', 'Parcelado Cartão de Crédito', 'Pix + Cartão de Crédito') THEN
          v_taxa_cartao_pct := CASE NEW.fornecedor
            WHEN 'BRT'     THEN 0.0399
            WHEN 'MaisFly' THEN 0.0399
            ELSE NULL
          END;
          IF v_taxa_cartao_pct IS NOT NULL THEN
            v_taxa_cartao_val := ROUND(v_base * v_taxa_cartao_pct, 2);
            v_base := v_base - v_taxa_cartao_val;
          END IF;
        END IF;

        v_valor := ROUND(v_base * v_percentual_usado / 100, 2);
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

-- Atualiza trigger de update de comissão para usar comissao_seguro_percentual do vendedor
CREATE OR REPLACE FUNCTION public.atualizar_comissao_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_percentual       NUMERIC(5,2);
  v_percentual_usado NUMERIC(5,2);
  v_base             NUMERIC(10,2);
  v_taxa_cartao_pct  NUMERIC(6,4);
  v_taxa_cartao_val  NUMERIC(10,2);
  v_valor            NUMERIC(10,2);
  v_comissao_id      UUID;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status NOT IN ('confirmada', 'concluida') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_comissao_id
  FROM public.comissoes
  WHERE venda_id = NEW.id
    AND status = 'pendente'
  LIMIT 1;

  IF v_comissao_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.categoria_venda = 'seguro_viagem' THEN
    v_base := ROUND(COALESCE(NEW.valor_total, 0) * 40 / 100, 2);

    SELECT comissao_seguro_percentual INTO v_percentual
      FROM public.usuarios
     WHERE id = NEW.vendedor_id;

    v_percentual_usado := COALESCE(v_percentual, 0);
    v_valor := ROUND(v_base * v_percentual_usado / 100, 2);
  ELSE
    SELECT comissao_percentual INTO v_percentual
      FROM public.usuarios
     WHERE id = NEW.vendedor_id;

    v_base             := COALESCE(NEW.taxa_rav, 0) + COALESCE(NEW.taxa_du, 0);
    v_percentual_usado := COALESCE(v_percentual, 0);

    IF NEW.forma_pagamento IN ('1x Cartão de Crédito', 'Parcelado Cartão de Crédito', 'Pix + Cartão de Crédito') THEN
      v_taxa_cartao_pct := CASE NEW.fornecedor
        WHEN 'BRT'     THEN 0.0399
        WHEN 'MaisFly' THEN 0.0399
        ELSE NULL
      END;
      IF v_taxa_cartao_pct IS NOT NULL THEN
        v_taxa_cartao_val := ROUND(v_base * v_taxa_cartao_pct, 2);
        v_base := v_base - v_taxa_cartao_val;
      END IF;
    END IF;

    v_valor := ROUND(v_base * v_percentual_usado / 100, 2);
  END IF;

  UPDATE public.comissoes
  SET
    vendedor_id = NEW.vendedor_id,
    valor_venda = COALESCE(NEW.valor_total, 0),
    base_calculo = v_base,
    percentual_comissao = v_percentual_usado,
    valor_comissao = v_valor
  WHERE id = v_comissao_id;

  UPDATE public.contas_pagar
  SET valor = v_valor
  WHERE comissao_id = v_comissao_id
    AND status = 'pendente';

  RETURN NEW;
END;
$$;
