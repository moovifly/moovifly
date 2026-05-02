-- SELECT em usuarios: política anterior com OR + get_user_tipo() pode degradar pesadamente ou
-- falhar quando o comportamento do SECURITY DEFINER + RLS não bypassa como no ambiente Supabase.
-- Duas políticas permissivas são avaliadas em OR (equivale ao que tínhamos, sem circularidade na leitura do próprio user).

DROP POLICY IF EXISTS "usuarios_select" ON public.usuarios;

CREATE POLICY "usuarios_select_own" ON public.usuarios
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "usuarios_select_managers" ON public.usuarios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuarios AS u
      WHERE u.user_id = (SELECT auth.uid())
        AND u.tipo IN ('administrador', 'gerente')
    )
  );

CREATE OR REPLACE FUNCTION public.get_user_tipo()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.tipo FROM public.usuarios AS u WHERE u.user_id = auth.uid() LIMIT 1;
$$;
