-- Armazena dados detalhados dos passageiros (nome, CPF/passaporte, data de nascimento) como JSONB.
-- A coluna passageiros (INTEGER) permanece para contagem de PAX.

ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS passageiros_dados JSONB;

COMMENT ON COLUMN public.vendas.passageiros_dados IS 'Lista de passageiros com nome, documento e data_nascimento';
