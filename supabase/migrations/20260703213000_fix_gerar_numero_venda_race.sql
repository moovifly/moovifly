-- Corrige condição de corrida na geração de numero_venda (MAX+1 sem lock).
CREATE SEQUENCE IF NOT EXISTS public.vendas_numero_seq;

SELECT setval(
  'public.vendas_numero_seq',
  COALESCE(
    (SELECT MAX(CAST(SUBSTRING(numero_venda FROM 4) AS INT))
     FROM public.vendas
     WHERE numero_venda ~ '^VDA'),
    0
  ),
  true
);

CREATE OR REPLACE FUNCTION public.gerar_numero_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero_venda IS NULL THEN
    NEW.numero_venda := 'VDA' || LPAD(nextval('public.vendas_numero_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
