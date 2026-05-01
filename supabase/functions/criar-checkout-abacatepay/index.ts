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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });

    const { venda_id } = await req.json();
    if (!venda_id) return new Response(JSON.stringify({ error: "venda_id obrigatório" }), { status: 400, headers: corsHeaders });

    const { data: venda, error: vendaError } = await supabase
      .from("vendas")
      .select("*, clientes(nome, email, cpf_cnpj, telefone)")
      .eq("id", venda_id)
      .single();

    if (vendaError || !venda) {
      return new Response(JSON.stringify({ error: "Venda não encontrada" }), { status: 404, headers: corsHeaders });
    }

    const cliente = Array.isArray(venda.clientes) ? venda.clientes[0] : venda.clientes;

    const abacateApiKey = Deno.env.get("ABACATEPAY_API_KEY")!;
    const baseUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://moovifly.com.br";

    // Criar produto no AbacatePay
    const productRes = await fetch("https://api.abacatepay.com/v1/products/create", {
      method: "POST",
      headers: { "Authorization": `Bearer ${abacateApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Viagem — ${venda.destino ?? venda.numero_venda}`,
        description: `Venda ${venda.numero_venda} — MooviFly Turismo`,
        price: Math.round(Number(venda.valor_total) * 100),
        quantity: 1,
      }),
    });

    if (!productRes.ok) {
      const prodErr = await productRes.text();
      return new Response(JSON.stringify({ error: `AbacatePay produto: ${prodErr}` }), { status: 500, headers: corsHeaders });
    }

    const product = await productRes.json();

    // Criar cobrança/checkout
    const billingRes = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: { "Authorization": `Bearer ${abacateApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        products: [{ productId: product.data.id, quantity: 1 }],
        customer: {
          name: cliente?.nome ?? "Cliente MooviFly",
          email: cliente?.email ?? "",
          document: cliente?.cpf_cnpj?.replace(/\D/g, "") ?? "",
          phone: cliente?.telefone?.replace(/\D/g, "") ?? "",
        },
        returnUrl: `${baseUrl}/backoffice/checkout`,
        completionUrl: `${baseUrl}/backoffice/checkout?paid=1`,
      }),
    });

    if (!billingRes.ok) {
      const billErr = await billingRes.text();
      return new Response(JSON.stringify({ error: `AbacatePay billing: ${billErr}` }), { status: 500, headers: corsHeaders });
    }

    const billing = await billingRes.json();
    const checkoutUrl: string = billing.data?.url ?? billing.data?.checkoutUrl ?? "";

    // Salvar no banco
    await supabase.from("pagamentos").insert({
      venda_id,
      valor: venda.valor_total,
      status: "pendente",
      checkout_url: checkoutUrl,
      billing_id: billing.data?.id ?? null,
      produto_id: product.data?.id ?? null,
    });

    return new Response(JSON.stringify({ url: checkoutUrl, billing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
