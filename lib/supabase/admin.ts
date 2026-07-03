import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Cliente com service role — apenas em rotas/API do servidor; nunca exponha ao browser. */
export function createAdminClient() {
  const client = tryCreateAdminClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente. Em Supabase → Project Settings → API, copie a secret \"service_role\" e adicione na Vercel (sem prefixo NEXT_PUBLIC_). Depois redeploy.",
    );
  }
  return client;
}

/** Retorna admin client ou null se a service role não estiver configurada (ex.: dev local). */
export function tryCreateAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
