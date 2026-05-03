-- Alinha o schema ao front-end: colunas usuario_id → vendedor_id (clientes, orçamentos, vendas)
-- e adiciona taxa_du / comissao_percentual em vendas (evita 400 em PATCH com campos inexistentes).

DROP POLICY IF EXISTS "orcamentos_select" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_update" ON public.orcamentos;
DROP POLICY IF EXISTS "vendas_select" ON public.vendas;
DROP POLICY IF EXISTS "vendas_update" ON public.vendas;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE public.clientes RENAME COLUMN usuario_id TO vendedor_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orcamentos' AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE public.orcamentos RENAME COLUMN usuario_id TO vendedor_id;
  END IF;
END $$;

ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS taxa_du NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS comissao_percentual NUMERIC(5, 2) DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendas' AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE public.vendas RENAME COLUMN usuario_id TO vendedor_id;
  END IF;
END $$;

CREATE POLICY "orcamentos_select" ON public.orcamentos FOR SELECT USING (
  vendedor_id IN (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);

CREATE POLICY "orcamentos_update" ON public.orcamentos FOR UPDATE USING (
  vendedor_id IN (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);

CREATE POLICY "vendas_select" ON public.vendas FOR SELECT USING (
  vendedor_id IN (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);

CREATE POLICY "vendas_update" ON public.vendas FOR UPDATE USING (
  vendedor_id IN (SELECT id FROM public.usuarios WHERE user_id = auth.uid())
  OR get_user_tipo() IN ('administrador', 'gerente')
);

CREATE OR REPLACE FUNCTION public.criar_comissao_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('confirmada', 'concluida') AND OLD.status = 'pendente' THEN
    IF NOT EXISTS (SELECT 1 FROM public.comissoes WHERE venda_id = NEW.id) THEN
      INSERT INTO public.comissoes (venda_id, usuario_id, valor, percentual, status)
      VALUES (NEW.id, NEW.vendedor_id, ROUND(NEW.taxa_rav * 0.05, 2), 5.0, 'pendente');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.clientes.vendedor_id IS 'Usuário (vendedor) responsável pelo cliente';
COMMENT ON COLUMN public.orcamentos.vendedor_id IS 'Usuário (vendedor) dono do orçamento';
COMMENT ON COLUMN public.vendas.vendedor_id IS 'Usuário (vendedor) dono da venda';
