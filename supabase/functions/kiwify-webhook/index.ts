import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const KIWIFY_SECRET = Deno.env.get("KIWIFY_WEBHOOK_SECRET") ?? "";
const APP_URL       = Deno.env.get("APP_URL") ?? "https://mundodamamae.com.br";

const REVOKE_EVENTS = new Set([
  "compra_reembolsada",
  "refunded",
  "chargeback",
  "subscription_canceled",
  "order_refunded",
]);

const APPROVE_EVENTS = new Set([
  "compra_aprovada",
  "order_approved",
  "paid",
  "purchase_approved",
]);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // Validação de assinatura HMAC-SHA256
  const signature =
    new URL(req.url).searchParams.get("signature") ??
    req.headers.get("x-kiwify-signature") ??
    req.headers.get("x-webhook-signature");

  if (KIWIFY_SECRET && !(await isValidSignature(rawBody, signature, KIWIFY_SECRET))) {
    console.error("Invalid webhook signature");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Normalizar campos do payload Kiwify
  const eventType =
    (payload.webhook_event_type as string) ??
    (payload.order_status as string) ??
    (payload.event as string) ??
    "";

  const customer = (payload.Customer ?? payload.customer ?? {}) as Record<string, string>;
  const email    = (customer.email ?? (payload.email as string) ?? "").toLowerCase().trim();
  const orderId  = (payload.order_id ?? payload.id ?? "") as string;

  const product        = (payload.Product ?? payload.product ?? {}) as Record<string, string>;
  const productId      = (product.product_id ?? (payload.product_id as string) ?? "") as string;
  const productName    = (product.product_name ?? (payload.product_name as string) ?? "Malinha da Maternidade") as string;
  const customerName   = (customer.full_name ?? customer.name ?? "") as string;

  if (!email) {
    console.error("Webhook sem e-mail no payload");
    return new Response("No email", { status: 400 });
  }

  console.log(`Webhook recebido: event=${eventType} email=${email} order=${orderId}`);

  // Idempotência: não processar o mesmo evento duas vezes
  const { error: logErr } = await supabase.from("webhook_events").insert({
    event_type: eventType,
    order_id:   orderId,
    email,
    raw:        payload,
  });

  if (logErr?.code === "23505") {
    console.log("Evento duplicado, ignorando:", orderId, eventType);
    return new Response("Already processed", { status: 200 });
  }

  // REVOGAR acesso
  if (REVOKE_EVENTS.has(eventType)) {
    const { error } = await supabase
      .from("memberships")
      .update({
        status:     "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);

    if (error) console.error("Erro ao revogar:", error);
    else console.log(`Acesso revogado: ${email}`);

    return new Response("Revoked", { status: 200 });
  }

  // CONCEDER acesso
  if (APPROVE_EVENTS.has(eventType)) {
    // Upsert membership
    const { error: memberErr } = await supabase.from("memberships").upsert(
      {
        email,
        status:       "active",
        order_id:     orderId,
        product_id:   productId,
        product_name: productName,
        granted_at:   new Date().toISOString(),
        updated_at:   new Date().toISOString(),
        revoked_at:   null,
      },
      { onConflict: "email" }
    );

    if (memberErr) {
      console.error("Erro ao criar membership:", memberErr);
      return new Response("DB error", { status: 500 });
    }

    // Verificar se usuário já existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existing) {
      // Reativar: só atualiza o user_id no membership
      await supabase
        .from("memberships")
        .update({ user_id: existing.id, updated_at: new Date().toISOString() })
        .eq("email", email);
      console.log(`Acesso reativado para usuário existente: ${email}`);
    } else {
      // Novo usuário: enviar convite para definir senha
      const { data: invite, error: invErr } =
        await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${APP_URL}/definir-senha`,
          data: { full_name: customerName },
        });

      if (invErr) {
        console.error("Erro ao convidar usuário:", invErr);
      } else if (invite?.user?.id) {
        await supabase
          .from("memberships")
          .update({ user_id: invite.user.id, updated_at: new Date().toISOString() })
          .eq("email", email);
        console.log(`Convite enviado para: ${email}`);
      }
    }

    return new Response("Granted", { status: 200 });
  }

  console.log(`Evento ignorado: ${eventType}`);
  return new Response("Ignored", { status: 200 });
});

async function isValidSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(body)
    );
    const hex = [...new Uint8Array(mac)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex === signature.toLowerCase();
  } catch {
    return false;
  }
}
