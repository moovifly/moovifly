-- Alinha atualizar_comissao_on_venda com a regra de comissão de Serviço (50% admin/Sandra, 40% demais)

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
  v_vendedor_tipo    TEXT;
  v_vendedor_nome    TEXT;
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

  ELSIF NEW.categoria_venda = 'servico' THEN
    v_base := COALESCE(NEW.taxa_rav, 0) + COALESCE(NEW.taxa_du, 0);

    SELECT tipo, nome INTO v_vendedor_tipo, v_vendedor_nome
      FROM public.usuarios
     WHERE id = NEW.vendedor_id;

    IF v_vendedor_tipo = 'administrador'
       OR COALESCE(v_vendedor_nome, '') ILIKE 'Sandra%'
    THEN
      v_percentual_usado := 50;
    ELSE
      v_percentual_usado := 40;
    END IF;

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
