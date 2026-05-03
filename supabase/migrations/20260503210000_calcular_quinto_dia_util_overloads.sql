-- O trigger gerar_comissao_venda_concluida chama calcular_quinto_dia_util com
-- DATE_TRUNC(...) + INTERVAL, que é timestamp/timestamptz — a função base só aceitava date.

CREATE OR REPLACE FUNCTION public.calcular_quinto_dia_util(p_ts timestamp with time zone)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT public.calcular_quinto_dia_util((p_ts AT TIME ZONE 'America/Sao_Paulo')::date);
$$;

CREATE OR REPLACE FUNCTION public.calcular_quinto_dia_util(p_ts timestamp without time zone)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT public.calcular_quinto_dia_util(p_ts::date);
$$;

COMMENT ON FUNCTION public.calcular_quinto_dia_util(timestamp with time zone) IS
  'Delega para calcular_quinto_dia_util(date) usando a data em America/Sao_Paulo.';

COMMENT ON FUNCTION public.calcular_quinto_dia_util(timestamp without time zone) IS
  'Delega para calcular_quinto_dia_util(date) usando o componente de data.';
