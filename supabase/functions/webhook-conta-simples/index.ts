import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
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

function normalizeDateTime(value: unknown): string {
  if (typeof value === "string" || value instanceof Date || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function normalizeSignature(signature: string): string {
  return signature.replace(/^sha256=/i, "").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  let eventId = "";
  try {
    if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

    const signatureSecret = getRequiredEnv("CONTA_SIMPLES_WEBHOOK_SECRET");
    const signatureHeaderName = (Deno.env.get("CONTA_SIMPLES_WEBHOOK_SIGNATURE_HEADER") ??
      "x-conta-simples-signature").toLowerCase();
    const signatureMode = (Deno.env.get("CONTA_SIMPLES_WEBHOOK_SIGNATURE_MODE") ?? "plain").toLowerCase();
    const requestId = req.headers.get("x-request-id");

    const signature = req.headers.get(signatureHeaderName);
    if (!signature) return jsonResponse({ error: "Assinatura ausente" }, 401);

    const bodyText = await req.text();
    if (!bodyText) return jsonResponse({ error: "Body vazio" }, 400);

    if (signatureMode === "hmac_sha256") {
      const expected = await hmacSha256Hex(signatureSecret, bodyText);
      if (!safeCompare(normalizeSignature(signature), normalizeSignature(expected))) {
        return jsonResponse({ error: "Assinatura inválida" }, 401);
      }
    } else if (!safeCompare(normalizeSignature(signature), normalizeSignature(signatureSecret))) {
      return jsonResponse({ error: "Assinatura inválida" }, 401);
    }

    const payload = JSON.parse(bodyText) as Record<string, unknown>;
    const eventType = String(payload.event ?? payload.type ?? "unknown.event");
    const eventRawId = payload.id ?? payload.eventId ?? payload.event_id ?? requestId ?? crypto.randomUUID();
    eventId = String(eventRawId);

    const { data: existingEvent } = await supabase
      .from("integration_events")
      .select("id,status")
      .eq("provider", "conta_simples")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent?.id) {
      return jsonResponse({ ok: true, duplicated: true, eventId }, 200);
    }

    const { error: insertEventError } = await supabase.from("integration_events").insert({
      provider: "conta_simples",
      event_id: eventId,
      event_type: eventType,
      request_id: requestId,
      payload,
      status: "pending",
      attempts: 0,
      received_at: new Date().toISOString(),
    });
    if (insertEventError) throw insertEventError;

    const dataObj = (payload.data ?? payload.transaction ?? payload) as Record<string, unknown>;
    const amount = parseAmount(dataObj.amountBrl ?? dataObj.amount ?? dataObj.value ?? dataObj.totalAmountBrl);
    if (amount === null) {
      await supabase
        .from("integration_events")
        .update({
          status: "ignored",
          last_error: "Evento recebido sem campo de valor numérico para transação.",
          processed_at: new Date().toISOString(),
        })
        .eq("provider", "conta_simples")
        .eq("event_id", eventId);

      return jsonResponse({ ok: true, ignored: true, eventId }, 200);
    }

    const externalId = String(
      dataObj.id ??
        dataObj.transactionId ??
        dataObj.transaction_id ??
        dataObj.statementId ??
        dataObj.statement_id ??
        dataObj.externalId ??
        dataObj.external_id ??
        `event:${eventId}`,
    );

    const categoryExternalId =
      dataObj.categoryId ?? dataObj.category_id ?? ((dataObj.category as Record<string, unknown> | undefined)?.id ?? null);
    const costCenterExternalId =
      dataObj.costCenterId ??
      dataObj.cost_center_id ??
      ((dataObj.costCenter as Record<string, unknown> | undefined)?.id ?? null);

    const categoryKey = categoryExternalId == null ? null : String(categoryExternalId);
    const costCenterKey = costCenterExternalId == null ? null : String(costCenterExternalId);

    const [categoryNameResult, costCenterNameResult] = await Promise.all([
      categoryKey
        ? supabase.from("conta_simples_categories").select("name").eq("external_id", categoryKey).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      costCenterKey
        ? supabase.from("conta_simples_cost_centers").select("name").eq("external_id", costCenterKey).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const { data: txRows, error: txError } = await supabase
      .from("conta_simples_transactions")
      .upsert(
        {
          provider: "conta_simples",
          external_id: externalId,
          source_path: String(payload.source ?? payload.path ?? "webhook"),
          description: String(
            dataObj.description ??
              dataObj.title ??
              dataObj.merchantName ??
              (dataObj.establishment as Record<string, unknown> | undefined)?.name ??
              `Evento ${eventType}`,
          ),
          amount_brl: amount,
          transaction_date: normalizeDateTime(
            dataObj.transactionDate ?? dataObj.transaction_date ?? dataObj.createdAt ?? dataObj.created_at ?? dataObj.date,
          ),
          transaction_status: String(dataObj.status ?? "pendente"),
          category_external_id: categoryKey,
          category_name:
            String(
              dataObj.categoryName ??
                (dataObj.category as Record<string, unknown> | undefined)?.name ??
                categoryNameResult.data?.name ??
                "",
            ) || null,
          cost_center_external_id: costCenterKey,
          cost_center_name:
            String(
              dataObj.costCenterName ??
                (dataObj.costCenter as Record<string, unknown> | undefined)?.name ??
                costCenterNameResult.data?.name ??
                "",
            ) || null,
          request_id: requestId,
          raw_payload: payload,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "provider,external_id" },
      )
      .select("id");
    if (txError) throw txError;

    const txId = txRows?.[0]?.id;
    if (txId) {
      const { error: reconcileError } = await supabase.rpc("reconcile_conta_simples_transaction", {
        p_transaction_id: txId,
      });
      if (reconcileError) throw reconcileError;
    }

    const { error: updateEventError } = await supabase
      .from("integration_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "conta_simples")
      .eq("event_id", eventId);
    if (updateEventError) throw updateEventError;

    return jsonResponse({ ok: true, eventId }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (eventId) {
      await supabase
        .from("integration_events")
        .update({
          status: "failed",
          attempts: 1,
          last_error: message,
          processed_at: new Date().toISOString(),
        })
        .eq("provider", "conta_simples")
        .eq("event_id", eventId);
    }

    return jsonResponse({ error: message, eventId: eventId || null }, 500);
  }
});
