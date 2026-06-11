# Espaço da Maternidade — Mundo da Mamãe

Plataforma de produto digital vendendo a **Malinha da Maternidade** (checklist PDF, R$19,70) via Kiwify.

---

## Stack

- **Frontend**: HTML/CSS/JS vanilla — Vercel (`https://pg-malinnha-da-maternidade.vercel.app`)
- **Auth + DB + Storage**: Supabase (`https://xvunlcjrcbbppqdzczcf.supabase.co`)
- **Pagamentos**: Kiwify (`https://pay.kiwify.com.br/3TU0Lm8`)
- **E-mail**: Resend (pendente domínio verificado)
- **PDF animado**: PDF.js + StPageFlip

---

## Páginas

| Rota | Arquivo | Descrição |
|---|---|---|
| `/` | `index.html` | Página de vendas |
| `/obrigado` | `obrigado/index.html` | Página pós-compra da Kiwify |
| `/area` | `area/index.html` | Plataforma de membros (login + leitor) |
| `/admin` | `admin/index.html` | Painel administrativo (acesso restrito) |
| `/definir-senha` | `definir-senha/index.html` | Redefinir senha via link de reset |

---

## Fluxo completo de uma compra

1. Cliente compra na Kiwify
2. Kiwify redireciona para `/obrigado?email={email}` — a variável `{email}` é substituída pelo e-mail real do comprador
3. Página `/obrigado` lê o `?email=` via JS e injeta no botão CTA
4. Cliente clica no botão → vai para `/area?email=email@cliente.com`
5. Tela de cadastro abre com e-mail pré-preenchido
6. Cliente digita senha → clica "Criar conta e entrar"
7. `doSignup()` valida membership ativo no banco, cria conta no Supabase Auth, vincula `user_id`, faz login
8. Cliente entra direto na plataforma e acessa a Malinha

**Em paralelo (webhook):**
- Webhook Kiwify → Edge Function → upsert `memberships` com `status = active`
- URL do webhook: `https://xvunlcjrcbbppqdzczcf.supabase.co/functions/v1/kiwify-webhook`

---

## Configuração Kiwify

- **URL de obrigado**: `https://pg-malinnha-da-maternidade.vercel.app/obrigado?email={email}`
- **Webhook**: `https://xvunlcjrcbbppqdzczcf.supabase.co/functions/v1/kiwify-webhook`

---

## Supabase — configurações importantes

- **Authentication → Providers → Email:**
  - Allow new users to sign up: **ON**
  - Confirm email: **OFF** (obrigatório — senão o cliente não consegue logar após o signup)

- **Bucket**: `ebooks` (privado) — arquivo `malinha.pdf`
- **Signed URL**: 30 minutos (gerada no frontend ao abrir o leitor)

---

## Tabelas principais

- `memberships` — um registro por cliente (`email` único, `status: active | revoked`, `user_id` vinculado após signup)
- `webhook_events` — log de todos os webhooks recebidos (idempotência via `unique(provider, order_id, event_type)`)
- `products` — vitrine de produtos (`state: for_sale | unlocked | hidden`, `is_active`, `badge`, `sort`)
- `admins` — usuários admin (`user_id` FK para `auth.users`); função `is_admin()` usada nas RLS
- `settings` — configurações chave-valor JSON (`welcome`: título/corpo da boas-vindas com `{nome}`; `support`: whatsapp/enabled)
- `checklist_progress` — progresso do checklist por cliente (`user_id`, `item_key`, `checked`)
- `support_messages` — mensagens de suporte (`user_id`, `email`, `nickname`, `message`, `status: open|resolved`, `admin_reply`, `replied_at`)

---

## Painel Admin (`/admin`)

- Login com verificação via `sb.rpc("is_admin")` — nega acesso se não estiver na tabela `admins`
- Admin atual: `malinhadamaternidade@gmail.com`
- Seções: **Clientes** (lista + revogar/reativar), **Boas-vindas** (editar mensagem dinâmica), **Vitrine** (CRUD de produtos), **Suporte** (chat com clientes), **Configurações** (WhatsApp, novo admin)

---

## Sistema de Suporte

### Área do cliente (`/area` → seção Suporte)
- FAQ accordion com 5 perguntas estáticas
- Botão flutuante `💬` fixo no canto inferior direito (aparece após login)
- Janela de chat pop-up: mensagens do cliente à direita (bolha verde), respostas do suporte à esquerda (bolha creme)
- Badge de notificação no botão quando há resposta não lida
- Enter envia; Shift+Enter quebra linha

### Painel admin (`/admin` → seção Suporte)
- Layout duas colunas: lista de conversas (esquerda) + chat aberto (direita)
- Filtros: **Em aberto** (conversa tem ≥1 mensagem `open`) / **Resolvidos** (todas `resolved`)
- Ao clicar numa conversa: abre o histórico completo em bolhas + campo de resposta + botão "✓ Resolvido"
- "✓ Resolvido" marca **todas** as mensagens abertas da conversa via `.in("id", openIds)`
- Badge na sidebar com contagem de conversas abertas (carregado silenciosamente ao entrar no admin)

---

## Edge Function — kiwify-webhook

- Secrets necessários: `KIWIFY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `APP_URL`
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente
- Eventos de aprovação: `compra_aprovada`, `order_approved`, `paid`, `purchase_approved`
- Eventos de revogação: `compra_reembolsada`, `refunded`, `chargeback`, `subscription_canceled`, `order_refunded`

---

## E-mail (Resend)

- Chave: `re_bhf2gJ5B_9BDGSqrHKPhpiNaV72YGhLNW`
- Sem domínio verificado: e-mails só chegam para `chadacatarinaoficial@gmail.com`
- Quando tiver domínio: atualizar `from` na Edge Function e seguir `RESEND_INTEGRACAO.md`
- O fluxo principal **não depende de e-mail** — cliente acessa direto pelo link `/obrigado`

---

## Como testar sem compra real

1. Inserir membership manual no SQL Editor:
   ```sql
   insert into public.memberships (email, status, product_name, order_id)
   values ('seu@email.com', 'active', 'Malinha da Maternidade', 'teste-001');
   ```
2. Acessar: `https://pg-malinnha-da-maternidade.vercel.app/obrigado?email=seu@email.com`
3. Criar senha e entrar
4. Para retestar: deletar usuário em **Authentication → Users** (o membership não precisa ser recriado)
