import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verificar assinatura do webhook AbacatePay
    const webhookSecret = Deno.env.get("ABACATEPAY_WEBHOOK_SECRET");
    const signature = req.headers.get("x-abacatepay-signature");
    if (webhookSecret && signature !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Assinatura inválida" }), { status: 401, headers: corsHeaders });
    }

    const payload = await req.json();
    const { event, data } = payload;

    if (event === "billing.paid" || event === "billing.completed") {
      const billingId = data?.id ?? data?.billing_id;
      if (!billingId) return new Response("ok", { headers: corsHeaders });

      // Atualizar status do pagamento
      const { data: pag } = await supabase
        .from("pagamentos")
        .update({ status: "pago", paid_at: new Date().toISOString() })
        .eq("billing_id", billingId)
        .select("venda_id")
        .single();

      if (pag?.venda_id) {
        // Atualizar status da venda
        await supabase.from("vendas").update({ status: "confirmada" }).eq("id", pag.venda_id);

        // Criar conta a receber se não existir
        const { data: existing } = await supabase
          .from("contas_receber")
          .select("id")
          .eq("venda_id", pag.venda_id)
          .maybeSingle();

        if (!existing) {
          const { data: venda } = await supabase
            .from("vendas")
            .select("valor_total, numero_venda, data_venda, usuario_id")
            .eq("id", pag.venda_id)
            .single();

          if (venda) {
            await supabase.from("contas_receber").insert({
              venda_id: pag.venda_id,
              valor: venda.valor_total,
              status: "pago",
              data_vencimento: venda.data_venda,
              descricao: `Pagamento venda ${venda.numero_venda}`,
            });
          }
        } else {
          await supabase.from("contas_receber").update({ status: "pago" }).eq("venda_id", pag.venda_id);
        }
      }
    }

    if (event === "billing.expired" || event === "billing.cancelled") {
      const billingId = data?.id ?? data?.billing_id;
      if (billingId) {
        await supabase.from("pagamentos").update({ status: event === "billing.expired" ? "expirado" : "cancelado" }).eq("billing_id", billingId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
