-- Corrige erro de RLS quando vendedor confirma/atualiza venda:
-- "new row violates row-level security policy for table comissoes"
-- Triggers de comissão rodam como SECURITY DEFINER para bypassar RLS de INSERT/UPDATE.

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
        v_base             := ROUND(COALESCE(NEW.valor_total, 0) * 40 / 100, 2);
        v_percentual_usado := 50;
        v_valor            := ROUND(v_base * 50 / 100, 2);
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
    v_base             := ROUND(COALESCE(NEW.valor_total, 0) * 40 / 100, 2);
    v_percentual_usado := 50;
    v_valor            := ROUND(v_base * 50 / 100, 2);
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

CREATE OR REPLACE FUNCTION public.criar_conta_pagar_on_comissao_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendedor_nome VARCHAR(255);
  v_numero_venda VARCHAR(255);
BEGIN
  IF EXISTS (SELECT 1 FROM public.contas_pagar WHERE comissao_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_vendedor_nome FROM public.usuarios WHERE id = NEW.vendedor_id;

  IF NEW.venda_id IS NOT NULL THEN
    SELECT numero_venda INTO v_numero_venda FROM public.vendas WHERE id = NEW.venda_id;
  END IF;

  INSERT INTO public.contas_pagar (
    tipo_conta,
    venda_id,
    vendedor_id,
    comissao_id,
    fornecedor,
    categoria,
    descricao,
    valor,
    data_vencimento,
    status
  ) VALUES (
    'comissao',
    NEW.venda_id,
    NEW.vendedor_id,
    NEW.id,
    COALESCE(v_vendedor_nome, 'Vendedor'),
    'Comissão de Vendas',
    CASE
      WHEN v_numero_venda IS NOT NULL AND btrim(v_numero_venda) <> ''
        THEN 'Comissão sobre ' || v_numero_venda
      WHEN NEW.venda_id IS NULL
        THEN 'Comissão manual' || CASE WHEN v_vendedor_nome IS NOT NULL THEN ' — ' || v_vendedor_nome ELSE '' END
      ELSE 'Comissão de venda'
    END,
    NEW.valor_comissao,
    COALESCE(
      (SELECT data_vencimento FROM public.contas_pagar cp WHERE cp.comissao_id = NEW.id LIMIT 1),
      public.calcular_quinto_dia_util(DATE_TRUNC('month', CURRENT_DATE)::date + INTERVAL '1 month')
    ),
    CASE WHEN NEW.status = 'paga' THEN 'paga' ELSE 'pendente' END
  );

  IF NEW.status = 'paga' THEN
    UPDATE public.contas_pagar
    SET data_pagamento = COALESCE(NEW.data_pagamento, CURRENT_DATE)
    WHERE comissao_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_comissao ON public.vendas;
CREATE TRIGGER trg_atualizar_comissao
  AFTER UPDATE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_comissao_on_venda();
