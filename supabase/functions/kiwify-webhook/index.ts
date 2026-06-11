import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_KEY")!
);

const KIWIFY_SECRET = Deno.env.get("KIWIFY_WEBHOOK_SECRET") ?? "";
const APP_URL       = Deno.env.get("APP_URL") ?? "https://pg-malinnha-da-maternidade.vercel.app";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";

const REVOKE_EVENTS = new Set([
  "compra_reembolsada", "refunded", "chargeback",
  "subscription_canceled", "order_refunded",
]);

const APPROVE_EVENTS = new Set([
  "compra_aprovada", "order_approved", "paid", "purchase_approved",
]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();

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

  const eventType =
    (payload.webhook_event_type as string) ??
    (payload.order_status as string) ??
    (payload.event as string) ?? "";

  const customer     = (payload.Customer ?? payload.customer ?? {}) as Record<string, string>;
  const email        = (customer.email ?? (payload.email as string) ?? "").toLowerCase().trim();
  const orderId      = (payload.order_id ?? payload.id ?? "") as string;
  const product      = (payload.Product ?? payload.product ?? {}) as Record<string, string>;
  const productId    = (product.product_id ?? (payload.product_id as string) ?? "") as string;
  const productName  = (product.product_name ?? (payload.product_name as string) ?? "Malinha da Maternidade") as string;
  const customerName = (customer.full_name ?? customer.name ?? "") as string;

  if (!email) return new Response("No email", { status: 400 });

  console.log(`Webhook: event=${eventType} email=${email} order=${orderId}`);

  const { error: logErr } = await supabase.from("webhook_events").insert({
    event_type: eventType, order_id: orderId, email, raw: payload,
  });

  if (logErr?.code === "23505") return new Response("Already processed", { status: 200 });

  if (REVOKE_EVENTS.has(eventType)) {
    await supabase.from("memberships").update({
      status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("email", email);
    console.log(`Acesso revogado: ${email}`);
    return new Response("Revoked", { status: 200 });
  }

  if (APPROVE_EVENTS.has(eventType)) {
    const { error: memberErr } = await supabase.from("memberships").upsert({
      email, status: "active", order_id: orderId,
      product_id: productId, product_name: productName,
      granted_at: new Date().toISOString(), updated_at: new Date().toISOString(), revoked_at: null,
    }, { onConflict: "email" });

    if (memberErr) {
      console.error("Erro ao criar membership:", memberErr);
      return new Response("DB error", { status: 500 });
    }

    // Verificar se usuário já existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email);

    if (existing) {
      await supabase.from("memberships")
        .update({ user_id: existing.id, updated_at: new Date().toISOString() })
        .eq("email", email);
      console.log(`Acesso reativado: ${email}`);
    } else {
      // Gerar link de convite manualmente
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo: `${APP_URL}/definir-senha`,
          data: { full_name: customerName },
        },
      });

      if (linkErr) {
        console.error("Erro ao gerar link:", linkErr);
      } else {
        const confirmUrl = linkData?.properties?.action_link ?? "";

        // Atualizar user_id no membership
        if (linkData?.user?.id) {
          await supabase.from("memberships")
            .update({ user_id: linkData.user.id, updated_at: new Date().toISOString() })
            .eq("email", email);
        }

        // Enviar e-mail via API do Resend
        await sendWelcomeEmail(email, customerName, confirmUrl);
      }
    }

    return new Response("Granted", { status: 200 });
  }

  return new Response("Ignored", { status: 200 });
});

async function sendWelcomeEmail(email: string, name: string, confirmUrl: string) {
  const firstName = name ? name.split(" ")[0] : "mamãe";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fdf8f2;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f2;padding:40px 20px">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #ece1d4;border-radius:24px;overflow:hidden;box-shadow:0 12px 36px rgba(95,111,86,.12)">
      <tr>
        <td align="center" style="background:linear-gradient(135deg,#5f6f56,#7a8b6f);padding:36px 32px 28px">
          <div style="width:72px;height:72px;background:#f6ece0;border:2px solid #e9b8a8;border-radius:50%;display:inline-block;line-height:72px;font-size:36px;text-align:center">🤱</div>
          <p style="margin:14px 0 0;color:#eef2ea;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase">Mundo da Mamãe</p>
          <h1 style="margin:6px 0 0;color:#ffffff;font-size:24px;font-weight:700;font-family:Georgia,serif">Espaço da Maternidade</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:36px 36px 28px">
          <h2 style="margin:0 0 12px;color:#5f6f56;font-size:20px;font-family:Georgia,serif;font-weight:600">Olá, ${firstName}! Seu acesso está pronto 💚</h2>
          <p style="margin:0 0 18px;color:#7b7b72;font-size:15px;line-height:1.6">Que alegria! Sua compra da <strong style="color:#3a3a36">Malinha da Maternidade</strong> foi confirmada e seu acesso está liberado.</p>
          <p style="margin:0 0 10px;color:#7b7b72;font-size:15px;line-height:1.6">Para acessar sua plataforma, siga os passos:</p>
          <p style="margin:0 0 4px;color:#3a3a36;font-size:14px">1️⃣ Clique no botão abaixo para <strong>criar sua senha</strong></p>
          <p style="margin:0 0 28px;color:#3a3a36;font-size:14px">2️⃣ Após criar a senha, você já entra direto na plataforma</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(180deg,#7a8b6f,#5f6f56);color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:16px 40px;border-radius:99px">
                  Criar minha senha e entrar →
                </a>
              </td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;background:#f6ece0;border-radius:16px">
            <tr>
              <td style="padding:20px 24px">
                <p style="margin:0 0 12px;color:#5f6f56;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.1em">O que você vai encontrar</p>
                <p style="margin:0 0 8px;color:#3a3a36;font-size:14px">🎒 <strong>Malinha da Maternidade</strong> — leitor animado estilo livro</p>
                <p style="margin:0 0 8px;color:#3a3a36;font-size:14px">✅ Checklist completo da mãe, do bebê e do acompanhante</p>
                <p style="margin:0 0 8px;color:#3a3a36;font-size:14px">📄 Documentos essenciais que ninguém lembra</p>
                <p style="margin:0;color:#3a3a36;font-size:14px">🛍️ Vitrine exclusiva com outros produtos para sua jornada</p>
              </td>
            </tr>
          </table>
          <p style="margin:28px 0 0;color:#7b7b72;font-size:13px;line-height:1.6">⏰ Este link é válido por <strong>24 horas</strong>. Se tiver dificuldades, responda este e-mail que a gente te ajuda com carinho.</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:20px 32px 28px;border-top:1px solid #ece1d4">
          <p style="margin:0;color:#7b7b72;font-size:12px">Malinha da Maternidade © 2026 • <strong style="color:#5f6f56;font-family:Georgia,serif;font-style:italic">Mundo da Mamãe</strong></p>
          <p style="margin:6px 0 0;color:#7b7b72;font-size:11px">Produto digital • Acesso exclusivo para quem comprou</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Mundo da Mamãe <onboarding@resend.dev>",
      to: [email],
      subject: "Seu acesso ao Espaço da Maternidade está pronto 💚",
      html,
    }),
  });

  const result = await res.json();
  if (!res.ok) console.error("Erro Resend:", result);
  else console.log(`E-mail enviado para ${email}:`, result.id);
}

async function isValidSignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return hex === signature.toLowerCase();
  } catch {
    return false;
  }
}
