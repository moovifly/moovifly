import { createClient } from "@supabase/supabase-js";

/** Cliente com service role — apenas em rotas/API do servidor; nunca exponha ao browser. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim()) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ausente. Cadastre na Vercel (Production e Preview) e faça um novo deploy.",
    );
  }
  if (!serviceKey?.trim()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente. Em Supabase → Project Settings → API, copie a secret \"service_role\" e adicione na Vercel (sem prefixo NEXT_PUBLIC_). Depois redeploy.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
