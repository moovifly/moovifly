import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

type SyncPayload = {
  startDate?: string;
  endDate?: string;
  limit?: number;
};

type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeDate(value: string | undefined, fallback: Date): string {
  if (!value) return fallback.toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback.toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function buildDateWindows(startDate: string, endDate: string, maxDays = 62): Array<{ startDate: string; endDate: string }> {
  const out: Array<{ startDate: string; endDate: string }> = [];
  let cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + (maxDays - 1));
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    out.push({
      startDate: cursor.toISOString().slice(0, 10),
      endDate: chunkEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toExternalId(item: Record<string, unknown>, sourcePath: string): string {
  const raw =
    item.id ??
    item.transactionId ??
    item.transaction_id ??
    item.statementId ??
    item.statement_id ??
    item.externalId ??
    item.external_id;

  if (raw !== undefined && raw !== null) {
    return String(raw);
  }

  const signature = [
    sourcePath,
    item.createdAt ?? item.created_at ?? item.date ?? item.transactionDate ?? item.transaction_date ?? "",
    item.amountBrl ?? item.amount ?? item.value ?? "",
    item.description ?? item.title ?? item.establishmentName ?? "",
  ].join("|");

  return `derived:${signature}`;
}

function normalizeDateTime(value: unknown): string {
  if (typeof value === "string" || value instanceof Date || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

async function requestWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);

      if (!RETRYABLE_STATUS.has(response.status)) return response;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    }

    if (attempt < maxRetries - 1) {
      const waitTime = (2 ** attempt + Math.random()) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw new Error(`Falha após ${maxRetries} tentativas`);
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

async function upsertCategories(
  supabase: ReturnType<typeof createClient>,
  items: Record<string, unknown>[],
) {
  if (items.length === 0) return;

  const rows = items
    .map((item) => {
      const externalId = item.id;
      const name = item.name;
      if (externalId === undefined || !name) return null;
      const typeObj = (item.type ?? {}) as Record<string, unknown>;
      return {
        external_id: String(externalId),
        company_id: item.companyId ? String(item.companyId) : null,
        name: String(name),
        category_type: typeObj.type ? String(typeObj.type) : null,
        raw_payload: item,
        synced_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length === 0) return;

  const { error } = await supabase.from("conta_simples_categories").upsert(rows, { onConflict: "external_id" });
  if (error) throw error;
}

async function upsertCostCenters(
  supabase: ReturnType<typeof createClient>,
  items: Record<string, unknown>[],
) {
  if (items.length === 0) return;

  const rows = items
    .map((item) => {
      const externalId = item.id;
      const name = item.name ?? item.description;
      if (externalId === undefined || !name) return null;
      return {
        external_id: String(externalId),
        company_id: item.companyId ? String(item.companyId) : null,
        name: String(name),
        raw_payload: item,
        synced_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length === 0) return;

  const { error } = await supabase.from("conta_simples_cost_centers").upsert(rows, { onConflict: "external_id" });
  if (error) throw error;
}

async function fetchAllPages(
  baseUrl: string,
  endpointPath: string,
  token: string,
  startDate: string,
  endDate: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const allItems: Record<string, unknown>[] = [];
  let nextPageStartKey: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      startDate,
      endDate,
      limit: String(limit),
    });
    if (nextPageStartKey) params.set("nextPageStartKey", nextPageStartKey);

    const response = await requestWithRetry(
      `${baseUrl.replace(/\/$/, "")}/${endpointPath}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 404) {
      return [];
    }

    if (response.status === 401) {
      throw new Error("Token inválido/expirado durante paginação");
    }

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Erro no endpoint ${endpointPath}: ${response.status} ${errBody}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.transactions)
      ? payload.transactions
      : [];

    allItems.push(...(items as Record<string, unknown>[]));
    nextPageStartKey =
      typeof payload.nextPageStartKey === "string" ? payload.nextPageStartKey : undefined;
    if (!nextPageStartKey) break;
  }

  return allItems;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const runId = crypto.randomUUID();
  const supabase = createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

    const cronSecret = Deno.env.get("CONTA_SIMPLES_CRON_SECRET");
    const cronSecretHeader = req.headers.get("x-moovifly-cron-secret");
    const isCronCall = Boolean(
      cronSecret &&
        cronSecretHeader &&
        safeCompare(cronSecret.trim(), cronSecretHeader.trim()),
    );

    if (!isCronCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Não autorizado" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) return jsonResponse({ error: "Não autorizado" }, 401);

      const { data: profile, error: profileError } = await supabase
        .from("usuarios")
        .select("tipo")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile || !["administrador", "gerente"].includes(profile.tipo)) {
        return jsonResponse({ error: "Apenas administradores/gerentes podem sincronizar." }, 403);
      }
    }

    const payload = ((await req.json().catch(() => ({}))) ?? {}) as SyncPayload;
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 30);

    const startDate = normalizeDate(payload.startDate, defaultStart);
    const endDate = normalizeDate(payload.endDate, now);
    const limit = Math.max(5, Math.min(payload.limit ?? 100, 100));

    const clientId = getRequiredEnv("CONTA_SIMPLES_CLIENT_ID");
    const clientSecret = getRequiredEnv("CONTA_SIMPLES_CLIENT_SECRET");
    const baseUrl = getRequiredEnv("CONTA_SIMPLES_BASE_URL");
    const tokenUrl = getRequiredEnv("CONTA_SIMPLES_TOKEN_URL");
    const scope = Deno.env.get("CONTA_SIMPLES_SCOPE");
    const categoriesPath = Deno.env.get("CONTA_SIMPLES_CATEGORIES_PATH") ?? "categories/v1/categories";
    const costCentersPath = Deno.env.get("CONTA_SIMPLES_COST_CENTERS_PATH") ?? "cost-centers/v1/cost-centers";
    const transactionsPaths = (Deno.env.get("CONTA_SIMPLES_TRANSACTIONS_PATHS") ??
      "statements/v1/credit-card,statements/v1/bank-account")
      .split(",")
      .map((path) => path.trim())
      .filter(Boolean);

    await supabase.from("integration_events").upsert(
      {
        provider: "conta_simples",
        event_id: `sync:${runId}`,
        event_type: "sync.run.started",
        request_id: req.headers.get("x-request-id"),
        payload: { startDate, endDate, limit, transactionsPaths, triggeredBy: isCronCall ? "cron" : "manual" },
        status: "pending",
        attempts: 0,
        received_at: new Date().toISOString(),
      },
      { onConflict: "provider,event_id" },
    );

    const getToken = async (): Promise<string> => {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      });
      if (scope) body.set("scope", scope);

      const response = await requestWithRetry(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Falha ao autenticar Conta Simples: ${response.status} ${errBody}`);
      }

      const tokenPayload = (await response.json()) as TokenResponse;
      if (!tokenPayload.access_token) throw new Error("Token não retornado pela Conta Simples");
      return tokenPayload.access_token;
    };

    let bearerToken = await getToken();

    const requestWithAuthRetry = async (
      endpointPath: string,
      query: Record<string, string>,
    ): Promise<Record<string, unknown>[]> => {
      const params = new URLSearchParams(query);
      const url = `${baseUrl.replace(/\/$/, "")}/${endpointPath}?${params.toString()}`;
      let response = await requestWithRetry(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      if (response.status === 401) {
        bearerToken = await getToken();
        response = await requestWithRetry(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
          },
        });
      }

      if (response.status === 404) return [];
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Erro no endpoint ${endpointPath}: ${response.status} ${errBody}`);
      }

      const data = await response.json();
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.transactions)
        ? data.transactions
        : [];

      return items as Record<string, unknown>[];
    };

    const [categories, costCenters] = await Promise.all([
      requestWithAuthRetry(categoriesPath, { limit: "100" }),
      requestWithAuthRetry(costCentersPath, { limit: "100" }),
    ]);

    await upsertCategories(supabase, categories);
    await upsertCostCenters(supabase, costCenters);

    const { data: categoriesDb } = await supabase.from("conta_simples_categories").select("external_id,name");
    const { data: costCentersDb } = await supabase.from("conta_simples_cost_centers").select("external_id,name");
    const categoriesMap = new Map((categoriesDb ?? []).map((row) => [row.external_id, row.name]));
    const costCentersMap = new Map((costCentersDb ?? []).map((row) => [row.external_id, row.name]));

    const windows = buildDateWindows(startDate, endDate, 62);
    let syncedTransactions = 0;
    let reconciledRows = 0;

    for (const endpointPath of transactionsPaths) {
      for (const window of windows) {
        let items: Record<string, unknown>[] = [];
        try {
          items = await fetchAllPages(baseUrl, endpointPath, bearerToken, window.startDate, window.endDate, limit);
        } catch (error) {
          if (error instanceof Error && error.message.includes("Token inválido/expirado")) {
            bearerToken = await getToken();
            items = await fetchAllPages(baseUrl, endpointPath, bearerToken, window.startDate, window.endDate, limit);
          } else {
            throw error;
          }
        }

        if (items.length === 0) continue;

        const nowIso = new Date().toISOString();
        const rows = items
          .map((item) => {
            const amount = parseAmount(item.amountBrl ?? item.amount ?? item.value ?? item.totalAmountBrl);
            if (amount === null) return null;

            const categoryExternalId =
              item.categoryId ?? item.category_id ?? ((item.category as Record<string, unknown> | undefined)?.id ?? null);
            const costCenterExternalId =
              item.costCenterId ??
              item.cost_center_id ??
              ((item.costCenter as Record<string, unknown> | undefined)?.id ?? null);

            const categoryKey = categoryExternalId == null ? null : String(categoryExternalId);
            const costCenterKey = costCenterExternalId == null ? null : String(costCenterExternalId);

            return {
              provider: "conta_simples",
              external_id: toExternalId(item, endpointPath),
              source_path: endpointPath,
              description: String(
                item.description ??
                  item.title ??
                  item.merchantName ??
                  (item.establishment as Record<string, unknown> | undefined)?.name ??
                  "Transação Conta Simples",
              ),
              amount_brl: amount,
              transaction_date: normalizeDateTime(
                item.transactionDate ?? item.transaction_date ?? item.createdAt ?? item.created_at ?? item.date,
              ),
              transaction_status: String(item.status ?? "pendente"),
              category_external_id: categoryKey,
              category_name:
                String(
                  item.categoryName ??
                    (item.category as Record<string, unknown> | undefined)?.name ??
                    (categoryKey ? categoriesMap.get(categoryKey) : "") ??
                    "",
                ) || null,
              cost_center_external_id: costCenterKey,
              cost_center_name:
                String(
                  item.costCenterName ??
                    (item.costCenter as Record<string, unknown> | undefined)?.name ??
                    (costCenterKey ? costCentersMap.get(costCenterKey) : "") ??
                    "",
                ) || null,
              request_id: req.headers.get("x-request-id"),
              raw_payload: item,
              synced_at: nowIso,
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));

        if (rows.length === 0) continue;

        const { data: upsertedRows, error: upsertError } = await supabase
          .from("conta_simples_transactions")
          .upsert(rows, { onConflict: "provider,external_id" })
          .select("id");

        if (upsertError) throw upsertError;
        syncedTransactions += rows.length;

        for (const tx of upsertedRows ?? []) {
          const { error: reconcileError } = await supabase.rpc("reconcile_conta_simples_transaction", {
            p_transaction_id: tx.id,
          });
          if (!reconcileError) reconciledRows += 1;
        }
      }
    }

    await supabase
      .from("integration_events")
      .update({
        status: "processed",
        event_type: "sync.run.completed",
        payload: {
          startDate,
          endDate,
          limit,
          syncedTransactions,
          reconciledRows,
          categories: categories.length,
          costCenters: costCenters.length,
        },
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "conta_simples")
      .eq("event_id", `sync:${runId}`);

    return jsonResponse({
      ok: true,
      runId,
      startDate,
      endDate,
      syncedTransactions,
      reconciledRows,
      syncedCategories: categories.length,
      syncedCostCenters: costCenters.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await supabase
      .from("integration_events")
      .update({
        status: "failed",
        event_type: "sync.run.failed",
        attempts: 1,
        last_error: message,
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "conta_simples")
      .eq("event_id", `sync:${runId}`);

    return jsonResponse({ error: message, runId }, 500);
  }
});
