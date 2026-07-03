-- Trechos de voo estruturados em vendas (mesma estrutura de orcamentos.voos)
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS voos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vendas.voos IS
  'Trechos de voo: tipo, origem, destino, data_partida, horario_saida, data_chegada, horario_chegada, companhia, numero_voo';

-- Cache de status Aviationstack (acesso apenas via service role na API)
CREATE TABLE IF NOT EXISTS public.voo_status_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voo_status_cache_expires
  ON public.voo_status_cache (expires_at);

ALTER TABLE public.voo_status_cache ENABLE ROW LEVEL SECURITY;
