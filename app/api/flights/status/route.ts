import { NextResponse, type NextRequest } from "next/server";

import {
  aeroDataBoxNotFoundMessage,
  fetchFlightStatusFromAeroDataBox,
  hasAeroDataBoxKey,
} from "@/lib/aerodatabox";
import {
  buildFlightStatusResponse,
  fetchFlightStatusFromApi,
  FLIGHT_CACHE_TTL_MS,
  freePlanNotFoundReason,
  mapCachedPayload,
} from "@/lib/aviationstack";
import {
  buildFlightCacheKey,
  extractIataCode,
  getTrechoByIndex,
  normalizeFlightIata,
  resolveVoosForVenda,
  type FlightStatusResponse,
} from "@/lib/voos";
import { loadCompanhiasServer } from "@/lib/companhias-server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const vendaId = request.nextUrl.searchParams.get("vendaId")?.trim();
    const trechoParam = request.nextUrl.searchParams.get("trecho");
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const trechoIndex = trechoParam != null ? Math.max(0, parseInt(trechoParam, 10) || 0) : 0;

    if (!vendaId) {
      return NextResponse.json({ error: "Parâmetro vendaId é obrigatório." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "no_session" }, { status: 401 });
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, tipo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!usuario) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: venda, error: vendaError } = await supabase
      .from("vendas")
      .select("id, numero_venda, localizador, data_ida, data_volta, origem, destino, companhia, observacoes, voos, clientes(nome)")
      .eq("id", vendaId)
      .maybeSingle();

    if (vendaError) {
      return NextResponse.json({ error: vendaError.message }, { status: 500 });
    }
    if (!venda) {
      return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
    }

    const voos = resolveVoosForVenda({
      voos: venda.voos,
      observacoes: venda.observacoes,
      origem: venda.origem,
      destino: venda.destino,
      data_ida: venda.data_ida,
      data_volta: venda.data_volta,
      companhia: venda.companhia,
      companhiasLookup: loadCompanhiasServer(),
    });
    const trecho = getTrechoByIndex(voos, trechoIndex);
    const clienteRaw = venda.clientes as { nome: string } | { nome: string }[] | null;
    const clienteNome = Array.isArray(clienteRaw) ? clienteRaw[0]?.nome ?? null : clienteRaw?.nome ?? null;

    const metaBase = {
      venda: {
        id: venda.id,
        numero_venda: venda.numero_venda,
        localizador: venda.localizador,
        cliente_nome: clienteNome,
      },
      trecho,
      trecho_index: trechoIndex,
      voos,
      cached: false,
    };

    const flightIata = normalizeFlightIata(trecho?.numero_voo);
    const flightDate =
      trecho?.data_partida?.slice(0, 10) || venda.data_ida?.slice(0, 10) || null;
    const depIata = extractIataCode(trecho?.origem ?? venda.origem);
    const arrIata = extractIataCode(trecho?.destino ?? venda.destino);

    if (!flightIata) {
      if (depIata && arrIata && flightDate) {
        // Sem número do voo: tenta localizar pelo trecho + data (ex.: vendas só com localizador)
      } else {
        const response: FlightStatusResponse = buildFlightStatusResponse(null, {
          ...metaBase,
          notFoundMessage:
            "Número do voo não cadastrado. O localizador (PNR) não permite rastreamento automático — informe o número do voo na venda.",
        });
        return NextResponse.json(response);
      }
    }

    if (!flightDate) {
      const response: FlightStatusResponse = buildFlightStatusResponse(null, {
        ...metaBase,
        notFoundMessage: "Data do voo não informada na venda.",
      });
      return NextResponse.json(response);
    }

    const cacheKey = flightIata
      ? buildFlightCacheKey(flightIata, flightDate, depIata, arrIata)
      : buildFlightCacheKey("ROUTE", flightDate, depIata, arrIata);
    const admin = tryCreateAdminClient();

    if (admin && !refresh) {
      const { data: cached } = await admin
        .from("voo_status_cache")
        .select("payload, expires_at")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached?.payload) {
        const parsed = mapCachedPayload(cached.payload);
        if (parsed) {
          return NextResponse.json({ ...parsed, cached: true });
        }
      }
    }

    const hasAero = hasAeroDataBoxKey();
    const hasAviationstack = Boolean(process.env.AVIATIONSTACK_ACCESS_KEY?.trim());

    if (!hasAero && !hasAviationstack) {
      return NextResponse.json(
        buildFlightStatusResponse(null, {
          ...metaBase,
          notFoundMessage:
            "Integração de status de voo não configurada. Adicione AERODATABOX_API_KEY (ou AVIATIONSTACK_ACCESS_KEY).",
        }),
      );
    }

    // AeroDataBox é o provider primário (cobre datas futuras e históricas).
    // Aviationstack só entra quando a AeroDataBox não pôde responder (sem chave,
    // sem número de voo ou erro) — nunca sobrepõe um "não encontrado" definitivo,
    // pois o plano free dela casaria um voo ao vivo de hoje em embarques futuros.
    let apiResult = null;
    let usedProvider: "aerodatabox" | "aviationstack" | null = null;
    let aeroError: string | null = null;

    if (hasAero && flightIata) {
      try {
        apiResult = await fetchFlightStatusFromAeroDataBox({ flightIata, flightDate, depIata, arrIata });
        usedProvider = "aerodatabox";
      } catch (e) {
        aeroError = e instanceof Error ? e.message : String(e);
      }
    }

    if (usedProvider === null && hasAviationstack) {
      apiResult = await fetchFlightStatusFromApi({
        flightIata: flightIata ?? "",
        flightDate,
        depIata,
        arrIata,
      });
      usedProvider = "aviationstack";
    }

    if (usedProvider === null) {
      return NextResponse.json(
        buildFlightStatusResponse(null, {
          ...metaBase,
          notFoundMessage: aeroError
            ? `Falha ao consultar a AeroDataBox: ${aeroError}`
            : "Não foi possível consultar o status do voo.",
        }),
      );
    }

    const response: FlightStatusResponse = {
      ...buildFlightStatusResponse(apiResult, {
        ...metaBase,
        cached: false,
        notFoundMessage: apiResult
          ? undefined
          : usedProvider === "aerodatabox"
            ? aeroDataBoxNotFoundMessage(flightDate)
            : freePlanNotFoundReason(flightDate),
      }),
      provider: usedProvider,
    };

    const expiresAt = new Date(Date.now() + FLIGHT_CACHE_TTL_MS).toISOString();
    if (admin) {
      await admin.from("voo_status_cache").upsert(
        {
          cache_key: cacheKey,
          payload: response,
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: "cache_key" },
      );
    }

    return NextResponse.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
