-- Corrige erro de RLS quando vendedor cadastra/confirma venda:
-- "new row violates row-level security policy for table contas_receber"
-- Triggers que criam conta a receber automaticamente precisam bypassar RLS.

CREATE OR REPLACE FUNCTION public.criar_conta_receber_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Mesmo problema na tabela contas (upsert automático ao confirmar venda)
CREATE OR REPLACE FUNCTION public.fn_upsert_conta_receber_from_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_cliente_nome text;
  v_venc date;
  v_descricao text;
  v_obs text;
begin
  if new.status is distinct from 'confirmada' then
    return new;
  end if;

  select c.nome into v_cliente_nome
  from public.clientes c
  where c.id = new.cliente_id;

  v_descricao := coalesce(nullif(trim(v_cliente_nome), ''), 'Cliente');
  v_venc := coalesce(new.data_vencimento_pagamento, new.data_venda, current_date);
  v_obs := concat('Gerado automaticamente pela venda ', coalesce(new.numero_venda::text, new.id::text));

  insert into public.contas (
    tipo,
    tipo_conta,
    descricao,
    valor,
    data_vencimento,
    status,
    observacoes,
    venda_id,
    cliente_id
  ) values (
    'receber',
    'geral',
    v_descricao,
    new.valor_total,
    v_venc,
    'pendente',
    v_obs,
    new.id,
    new.cliente_id
  )
  on conflict (venda_id) where (tipo = 'receber')
  do update set
    descricao = excluded.descricao,
    valor = excluded.valor,
    data_vencimento = excluded.data_vencimento,
    status = case when public.contas.status = 'paga' then 'paga' else excluded.status end,
    observacoes = excluded.observacoes,
    cliente_id = excluded.cliente_id,
    updated_at = timezone('utc', now());

  return new;
end;
$$;
