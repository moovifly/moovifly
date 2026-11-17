-- Tipo do documento do cliente: CPF, CNPJ ou passaporte.
-- O número continua na coluna cpf para não quebrar recibos e checkout.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT NOT NULL DEFAULT 'cpf';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clientes_tipo_documento_check'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_tipo_documento_check
      CHECK (tipo_documento IN ('cpf', 'cnpj', 'passaporte'));
  END IF;
END $$;

UPDATE public.clientes
SET tipo_documento = 'passaporte'
WHERE cpf IS NOT NULL
  AND btrim(cpf) <> ''
  AND cpf ~ '[A-Za-z]';

UPDATE public.clientes
SET tipo_documento = 'cnpj'
WHERE tipo_documento = 'cpf'
  AND cpf IS NOT NULL
  AND cpf !~ '[A-Za-z]'
  AND regexp_replace(cpf, '\D', '', 'g') ~ '^\d{14}$';
