-- Ao excluir uma venda, libera o orçamento que apontava para ela (voltar a gerar venda).

CREATE OR REPLACE FUNCTION public.reset_orcamento_apos_exclusao_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orcamentos
  SET
    venda_id = NULL,
    convertido_venda = false,
    status = CASE WHEN status = 'convertido' THEN 'aprovado' ELSE status END
  WHERE venda_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendas_delete_reset_orcamento ON public.vendas;

CREATE TRIGGER trg_vendas_delete_reset_orcamento
  BEFORE DELETE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_orcamento_apos_exclusao_venda();
