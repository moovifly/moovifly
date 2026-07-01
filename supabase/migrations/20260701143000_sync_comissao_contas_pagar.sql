-- Sincronização bidirecional comissões ↔ contas_pagar (fonte única de saídas no fluxo de caixa).

CREATE OR REPLACE FUNCTION public.sync_comissao_contas_pagar_on_comissao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_vendedor_nome VARCHAR(255);
BEGIN
  IF NEW.status = 'paga' AND (OLD.status IS DISTINCT FROM 'paga') THEN
    UPDATE public.contas_pagar
    SET
      status = 'paga',
      data_pagamento = COALESCE(NEW.data_pagamento, CURRENT_DATE),
      valor = NEW.valor_comissao,
      conta_bancaria_id = COALESCE(NEW.conta_bancaria_id, conta_bancaria_id)
    WHERE comissao_id = NEW.id;

    IF NOT FOUND THEN
      SELECT nome INTO v_vendedor_nome
      FROM public.usuarios
      WHERE id = NEW.vendedor_id;

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
        data_pagamento,
        status,
        conta_bancaria_id
      ) VALUES (
        'comissao',
        NEW.venda_id,
        NEW.vendedor_id,
        NEW.id,
        COALESCE(v_vendedor_nome, 'Vendedor'),
        'Comissão de Vendas',
        'Comissão' || CASE WHEN v_vendedor_nome IS NOT NULL THEN ' — ' || v_vendedor_nome ELSE '' END,
        NEW.valor_comissao,
        COALESCE(NEW.data_pagamento, CURRENT_DATE),
        COALESCE(NEW.data_pagamento, CURRENT_DATE),
        'paga',
        NEW.conta_bancaria_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_comissao_contas_pagar_on_pagar()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.comissao_id IS NOT NULL
     AND NEW.status = 'paga'
     AND (OLD.status IS DISTINCT FROM 'paga') THEN
    UPDATE public.comissoes
    SET
      status = 'paga',
      data_pagamento = COALESCE(NEW.data_pagamento, CURRENT_DATE),
      valor_comissao = NEW.valor,
      conta_bancaria_id = COALESCE(NEW.conta_bancaria_id, conta_bancaria_id)
    WHERE id = NEW.comissao_id
      AND status IS DISTINCT FROM 'paga';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_conta_pagar_on_comissao_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_sync_comissao_paga ON public.comissoes;
CREATE TRIGGER trg_sync_comissao_paga
  AFTER UPDATE ON public.comissoes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_comissao_contas_pagar_on_comissao();

DROP TRIGGER IF EXISTS trg_sync_conta_pagar_comissao ON public.contas_pagar;
CREATE TRIGGER trg_sync_conta_pagar_comissao
  AFTER UPDATE ON public.contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_comissao_contas_pagar_on_pagar();

DROP TRIGGER IF EXISTS trg_criar_conta_pagar_comissao ON public.comissoes;
CREATE TRIGGER trg_criar_conta_pagar_comissao
  AFTER INSERT ON public.comissoes
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_conta_pagar_on_comissao_insert();

-- Backfill: comissões pagas sem conta a pagar vinculada
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
  data_pagamento,
  status
)
SELECT
  'comissao',
  c.venda_id,
  c.vendedor_id,
  c.id,
  COALESCE(u.nome, 'Vendedor'),
  'Comissão de Vendas',
  'Comissão (backfill)' || CASE WHEN u.nome IS NOT NULL THEN ' — ' || u.nome ELSE '' END,
  c.valor_comissao,
  COALESCE(c.data_pagamento, CURRENT_DATE),
  COALESCE(c.data_pagamento, CURRENT_DATE),
  'paga'
FROM public.comissoes c
LEFT JOIN public.usuarios u ON u.id = c.vendedor_id
WHERE c.status = 'paga'
  AND NOT EXISTS (
    SELECT 1 FROM public.contas_pagar cp WHERE cp.comissao_id = c.id
  );

-- Backfill: contas a pagar pendentes para comissões pendentes sem lançamento
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
)
SELECT
  'comissao',
  c.venda_id,
  c.vendedor_id,
  c.id,
  COALESCE(u.nome, 'Vendedor'),
  'Comissão de Vendas',
  CASE
    WHEN v.numero_venda IS NOT NULL AND btrim(v.numero_venda) <> ''
      THEN 'Comissão sobre ' || v.numero_venda
    ELSE 'Comissão' || CASE WHEN u.nome IS NOT NULL THEN ' — ' || u.nome ELSE '' END
  END,
  c.valor_comissao,
  public.calcular_quinto_dia_util(DATE_TRUNC('month', CURRENT_DATE)::date + INTERVAL '1 month'),
  'pendente'
FROM public.comissoes c
LEFT JOIN public.usuarios u ON u.id = c.vendedor_id
LEFT JOIN public.vendas v ON v.id = c.venda_id
WHERE c.status = 'pendente'
  AND NOT EXISTS (
    SELECT 1 FROM public.contas_pagar cp WHERE cp.comissao_id = c.id
  );

-- Backfill: sincronizar contas_pagar pendentes com comissões já pagas
UPDATE public.contas_pagar cp
SET
  status = 'paga',
  data_pagamento = COALESCE(c.data_pagamento, CURRENT_DATE),
  valor = c.valor_comissao
FROM public.comissoes c
WHERE cp.comissao_id = c.id
  AND c.status = 'paga'
  AND cp.status IS DISTINCT FROM 'paga';
