import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Valida sessão no servidor (cookies + refresh GoTrue no Node).
 * Evita refresh_token concorrente no browser, que dispara ERR_CONNECTION_RESET e lock steal.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return NextResponse.json({
        userId: null,
        access_token: null,
        refresh_token: null,
        error: error?.message ?? "no_session",
      });
    }

    return NextResponse.json({
      userId: session.user.id,
      user: session.user,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type,
      error: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ userId: null, error: message }, { status: 500 });
  }
}
