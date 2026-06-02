import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest, secret: string): boolean {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() === secret;
  }

  const cronHeader = request.headers.get("x-cron-secret");
  return cronHeader?.trim() === secret;
}

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CONTA_SIMPLES_CRON_SECRET ?? process.env.CRON_SECRET;
    if (!cronSecret?.trim()) {
      return NextResponse.json(
        { ok: false, error: "CONTA_SIMPLES_CRON_SECRET/CRON_SECRET ausente no ambiente." },
        { status: 500 },
      );
    }

    if (!isAuthorized(request, cronSecret.trim())) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!supabaseUrl) {
      return NextResponse.json(
        { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL ausente no ambiente." },
        { status: 500 },
      );
    }

    const lookbackDays = Number(process.env.CONTA_SIMPLES_CRON_LOOKBACK_DAYS ?? "2");
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - Math.max(Number.isFinite(lookbackDays) ? lookbackDays : 2, 1));

    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/conta-simples-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-moovifly-cron-secret": cronSecret.trim(),
      },
      body: JSON.stringify({
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        limit: 100,
      }),
    });

    const payload = await syncResponse.json().catch(() => ({}));
    return NextResponse.json(payload, { status: syncResponse.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
