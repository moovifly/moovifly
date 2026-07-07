-- Corrige geração de numero_orcamento (mesmo problema do fix de numero_venda, agravado pela RLS):
-- o trigger calculava MAX+1 com SELECT sujeito à RLS. Vendedores só enxergam os próprios
-- orçamentos, então o MAX deles fica atrás do máximo global e o número gerado já existe —
-- violação permanente de orcamentos_numero_orcamento_key, mesmo tentando de novo.
-- Sequence é global (ignora RLS) e livre de condição de corrida.
CREATE SEQUENCE IF NOT EXISTS public.orcamentos_numero_seq;

SELECT setval(
  'public.orcamentos_numero_seq',
  COALESCE(
    (SELECT MAX(CAST(SUBSTRING(numero_orcamento FROM 4) AS INT))
     FROM public.orcamentos
     WHERE numero_orcamento ~ '^ORC[0-9]+$'),
    0
  ),
  true
);

GRANT USAGE, UPDATE ON SEQUENCE public.orcamentos_numero_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gerar_numero_orcamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero_orcamento IS NULL THEN
    NEW.numero_orcamento := 'ORC' || LPAD(nextval('public.orcamentos_numero_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
