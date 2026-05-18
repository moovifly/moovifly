-- Status de comissões: pendente | paga | cancelada (concorda com "comissão" no feminino)

UPDATE public.comissoes SET status = 'paga' WHERE status = 'pago';
UPDATE public.comissoes SET status = 'cancelada' WHERE status = 'cancelado';

ALTER TABLE public.comissoes DROP CONSTRAINT IF EXISTS comissoes_status_check;
ALTER TABLE public.comissoes
  ADD CONSTRAINT comissoes_status_check
  CHECK (status IN ('pendente', 'paga', 'cancelada'));
