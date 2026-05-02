-- EXISTS sobre public.usuarios dentro de outra policy na mesma tabela faz o Postgres
-- reavaliar RLS no subselect → 42P17 infinite recursion detected in policy for relation "usuarios".
-- get_user_tipo() é SECURITY DEFINER (com search_path público aplicado antes): lê o tipo sem o ciclo.

DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_managers" ON public.usuarios;

CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR get_user_tipo() IN ('administrador', 'gerente')
  );
