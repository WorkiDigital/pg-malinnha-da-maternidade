# Integração Resend — E-mail HTML Mundo da Mamãe

> Quando tiver um domínio verificado no Resend, seguir este guia para ativar os e-mails em HTML.

## Por que o Resend?

- E-mails HTML com identidade visual da marca
- Remetente personalizado: `noreply@mundodamamae.com.br`
- Rastreamento de abertura e cliques
- Gratuito até 3.000 e-mails/mês
- Menos chance de cair no spam

## Configuração (quando tiver domínio)

### 1. Verificar domínio no Resend
1. Acesse resend.com → Domínios → Adicionar domínio
2. Digite `mundodamamae.com.br`
3. Adicione os registros DNS que o Resend mostrar no seu provedor (Registro.br, GoDaddy etc.)
4. Aguarde verificação (pode levar até 24h)

### 2. Atualizar SMTP no Supabase
```
SMTP Host:   smtp.resend.com
SMTP Port:   465
SMTP User:   resend
SMTP Pass:   re_bhf2gJ5B_9BDGSqrHKPhpiNaV72YGhLNW
From:        noreply@mundodamamae.com.br
Sender Name: Mundo da Mamãe
```

### 3. Atualizar remetente na Edge Function
Em `supabase/functions/kiwify-webhook/index.ts`, linha do `from`:
```ts
from: "Mundo da Mamãe <noreply@mundodamamae.com.br>",
```

### 4. Testar
```bash
supabase functions deploy kiwify-webhook --no-verify-jwt
```

---

## Credenciais salvas

| Variável | Valor |
|---|---|
| `RESEND_API_KEY` | `re_bhf2gJ5B_9BDGSqrHKPhpiNaV72YGhLNW` |
| SMTP Host | `smtp.resend.com` |
| SMTP Port | `465` |
| SMTP User | `resend` |

> A `RESEND_API_KEY` já está setada nos secrets da Edge Function no Supabase.
> O código de envio via API já está implementado em `kiwify-webhook/index.ts` — basta ter domínio verificado e trocar o `from`.

---

## Template HTML (convite pós-compra)

O template completo está implementado na função `sendWelcomeEmail()` em:
`supabase/functions/kiwify-webhook/index.ts`

Visual: paleta verde-sálvia + creme + blush, tipografia Georgia/Arial, botão "Criar minha senha e entrar →", card com o que o cliente vai encontrar na plataforma.
