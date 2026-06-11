# Setup — Espaço da Maternidade

## 1. Criar projeto no Supabase

1. Acesse https://supabase.com e crie um projeto
2. Anote: **Project URL** e as keys **anon/public** e **service_role**

## 2. Rodar o SQL

No Supabase → **SQL Editor**, cole e execute o conteúdo de:
```
supabase/migrations/001_initial.sql
```

## 3. Configurar autenticação

No Supabase → **Authentication → URL Configuration**:
- Site URL: `https://mundodamamae.com.br`
- Redirect URLs (adicionar): `https://mundodamamae.com.br/definir-senha`

Em **Authentication → Providers → Email**:
- Desabilitar "Confirm email" (o convite já faz isso)
- Desabilitar "Enable email signup" (só via webhook)

## 4. Criar bucket de e-books

No Supabase → **Storage → New Bucket**:
- Nome: `ebooks`
- Marcar como **Private** (não público)

Fazer upload do arquivo `Malinha da Maternidade.pdf` com o nome `malinha.pdf`.

## 5. Plugar as credenciais no frontend

Em `area/index.html` e `definir-senha/index.html`, substituir:
```
SUPABASE_URL_PLACEHOLDER      → https://SEUPROJETO.supabase.co
SUPABASE_ANON_KEY_PLACEHOLDER → eyJ... (anon/public key)
```

## 6. Publicar a Edge Function

Instalar Supabase CLI e rodar:
```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy kiwify-webhook --no-verify-jwt
```

Definir as variáveis de ambiente da função:
```bash
supabase secrets set SUPABASE_URL=https://SEUPROJETO.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...
supabase secrets set KIWIFY_WEBHOOK_SECRET=SEU_SEGREDO_KIWIFY
supabase secrets set APP_URL=https://mundodamamae.com.br
```

A URL da função será:
```
https://SEUPROJETO.supabase.co/functions/v1/kiwify-webhook
```

## 7. Configurar webhook na Kiwify

1. Kiwify → Configurações → Webhooks → Adicionar
2. URL: `https://SEUPROJETO.supabase.co/functions/v1/kiwify-webhook`
3. Eventos: `compra_aprovada`, `compra_reembolsada`, `chargeback`, `subscription_canceled`
4. Copiar o **Segredo** gerado → usar em `KIWIFY_WEBHOOK_SECRET`

## 8. Deploy na Vercel

Push para o GitHub → Vercel detecta e faz deploy automático.

Rotas disponíveis após deploy:
- `/`             → Página de vendas
- `/area`         → Plataforma de membros (login + leitor)
- `/definir-senha` → Definição de senha (via link do convite/reset)

## Variáveis de ambiente (resumo)

| Variável | Onde usar |
|---|---|
| `SUPABASE_URL` | Edge Function + frontend |
| `SUPABASE_ANON_KEY` | Frontend apenas (é pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function apenas (nunca no frontend) |
| `KIWIFY_WEBHOOK_SECRET` | Edge Function |
| `APP_URL` | Edge Function |

## Fluxo completo após configuração

1. Cliente compra na Kiwify
2. Kiwify dispara webhook → Edge Function cria membership + envia convite por e-mail
3. Cliente clica no link do e-mail → `/definir-senha` → define a senha
4. Cliente acessa `/area` → faz login → lê o e-book
5. Reembolso → webhook revoga o acesso automaticamente
