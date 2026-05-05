-- Alinha comissoes ao padrão vendedor_id (clientes/orçamentos/vendas).
-- Bases que já tinham só vendedor_id: renomeiação é ignorada; função e RLS são corrigidos.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'comissoes' AND column_name = 'usuario_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'comissoes' AND column_name = 'vendedor_id'
  ) THEN
    ALTER TABLE public.comissoes RENAME COLUMN usuario_id TO vendedor_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.criar_comissao_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('confirmada', 'concluida') AND OLD.status = 'pendente' THEN
    IF NOT EXISTS (SELECT 1 FROM public.comissoes WHERE venda_id = NEW.id) THEN
      INSERT INTO public.comissoes (venda_id, vendedor_id, valor, percentual, status)
      VALUES (NEW.id, NEW.vendedor_id, ROUND(NEW.taxa_rav * 0.05, 2), 5.0, 'pendente');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "comissoes_select" ON public.comissoes;
CREATE POLICY "comissoes_select" ON public.comissoes FOR SELECT USING (
  vendedor_id IN (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);
