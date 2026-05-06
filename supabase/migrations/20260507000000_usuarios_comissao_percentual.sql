-- Add comissao_percentual to usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS comissao_percentual NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Update trigger: commission = (taxa_rav + taxa_du) * vendor's comissao_percentual / 100
CREATE OR REPLACE FUNCTION public.criar_comissao_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_percentual NUMERIC(5,2);
  v_base       NUMERIC(10,2);
BEGIN
  IF NEW.status IN ('confirmada', 'concluida') AND OLD.status = 'pendente' THEN
    IF NOT EXISTS (SELECT 1 FROM public.comissoes WHERE venda_id = NEW.id) THEN
      SELECT comissao_percentual INTO v_percentual
      FROM public.usuarios
      WHERE id = NEW.vendedor_id;

      v_base := COALESCE(NEW.taxa_rav, 0) + COALESCE(NEW.taxa_du, 0);

      INSERT INTO public.comissoes (venda_id, vendedor_id, valor, percentual, status)
      VALUES (
        NEW.id,
        NEW.vendedor_id,
        ROUND(v_base * COALESCE(v_percentual, 0) / 100, 2),
        COALESCE(v_percentual, 0),
        'pendente'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
