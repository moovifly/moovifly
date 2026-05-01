# MooviFly — Guia de Deploy e Configuração em Produção

## Visão geral da stack

| Camada | Serviço | Função |
|---|---|---|
| Frontend / SSR | Vercel | Hospeda o app Next.js com deploy automático via GitHub |
| Banco de dados + Auth | Supabase | PostgreSQL, autenticação, Edge Functions |
| Domínio | Hostinger | `moovifly.com.br` apontando para Vercel |
| Pagamentos | AbacatePay | Checkout PIX via Edge Function |

---

## 1. Supabase — Configuração completa

### 1.1 Criar o primeiro usuário administrador

1. Acesse [supabase.com](https://supabase.com) → seu projeto `axrkvvjnubjxgejvrbmf`
2. Vá em **Authentication → Users → Add user**
3. Preencha email e senha do primeiro admin
4. Copie o **UUID** do usuário criado
5. Vá em **Table Editor → usuarios** → clique em **Insert row**:
   ```
   user_id: <UUID copiado>
   nome: Seu Nome
   email: seuemail@moovifly.com.br
   tipo: administrador
   ativo: true
   ```

### 1.2 Variáveis de ambiente do projeto

No painel do Supabase → **Project Settings → API**:

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` public key (JWT) |

Variáveis adicionais (apenas no Vercel, não no `.env.local` público):

| Variável | Descrição |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role key (apenas Edge Functions) |
| `ABACATEPAY_API_KEY` | Chave da API do AbacatePay |
| `ABACATEPAY_WEBHOOK_SECRET` | Secret para validar webhooks |
| `NEXT_PUBLIC_APP_URL` | Ex: `https://moovifly.com.br` |

### 1.3 Configurar Auth

No Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://moovifly.com.br`
- **Redirect URLs**: `https://moovifly.com.br/backoffice/**`

### 1.4 Deploy das Edge Functions

Com a [Supabase CLI](https://supabase.com/docs/guides/cli) instalada:

```bash
# Login na Supabase CLI
supabase login

# Linkar com o projeto
supabase link --project-ref axrkvvjnubjxgejvrbmf

# Configurar secrets das Edge Functions
supabase secrets set ABACATEPAY_API_KEY=sua_chave_aqui
supabase secrets set ABACATEPAY_WEBHOOK_SECRET=seu_secret_aqui
supabase secrets set NEXT_PUBLIC_APP_URL=https://moovifly.com.br

# Deploy das functions
supabase functions deploy criar-checkout-abacatepay
supabase functions deploy webhook-abacatepay
```

URLs das Edge Functions após deploy:
- `https://axrkvvjnubjxgejvrbmf.supabase.co/functions/v1/criar-checkout-abacatepay`
- `https://axrkvvjnubjxgejvrbmf.supabase.co/functions/v1/webhook-abacatepay`

### 1.5 Configurar webhook no AbacatePay

No painel do AbacatePay, cadastre o webhook URL:
```
https://axrkvvjnubjxgejvrbmf.supabase.co/functions/v1/webhook-abacatepay
```
Eventos: `billing.paid`, `billing.completed`, `billing.expired`, `billing.cancelled`

---

## 2. GitHub — Configuração do repositório

```bash
# Na raiz do projeto
git init  # se ainda não for um repositório git
git add .
git commit -m "feat: MooviFly v3 — projeto recriado do zero"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/moovifly.git
git push -u origin main
```

> O Vercel fará deploy automático a cada push na branch `main`.

---

## 3. Vercel — Deploy e configuração

### 3.1 Importar projeto

1. Acesse [vercel.com](https://vercel.com) → **Add New → Project**
2. Selecione o repositório **moovifly** do GitHub
3. Framework Preset: **Next.js** (detectado automaticamente)
4. Clique em **Deploy**

### 3.2 Variáveis de ambiente no Vercel

Após o primeiro deploy, vá em **Project → Settings → Environment Variables** e adicione:

```
NEXT_PUBLIC_SUPABASE_URL=https://axrkvvjnubjxgejvrbmf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=<service_role_key_do_supabase>
ABACATEPAY_API_KEY=<sua_chave_abacatepay>
ABACATEPAY_WEBHOOK_SECRET=<seu_webhook_secret>
NEXT_PUBLIC_APP_URL=https://moovifly.com.br
```

**Importante:** Configure para os ambientes **Production** e **Preview**.

### 3.3 Configurar domínio customizado

1. No Vercel → **Project → Settings → Domains**
2. Clique em **Add Domain**
3. Digite: `moovifly.com.br`
4. Copie os registros DNS fornecidos pelo Vercel

---

## 4. Hostinger — Configuração de DNS

1. Acesse o painel da **Hostinger → Domínios → moovifly.com.br → DNS / Zona DNS**
2. Adicione/edite os registros fornecidos pelo Vercel:

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| `A` | `@` | `76.76.21.21` | 3600 |
| `CNAME` | `www` | `cname.vercel-dns.com` | 3600 |

> Os IPs/valores exatos são fornecidos pelo Vercel no passo anterior.

3. Aguarde propagação DNS (geralmente 5–30 minutos)
4. O Vercel provisiona SSL (HTTPS) automaticamente via Let's Encrypt

### 4.1 Verificar configuração

Após propagação, acesse:
- `https://moovifly.com.br` → deve exibir o site
- `https://moovifly.com.br/backoffice` → deve redirecionar para login
- `https://www.moovifly.com.br` → deve funcionar também

---

## 5. Fluxo de desenvolvimento contínuo

```bash
# Criar feature
git checkout -b feature/nova-funcionalidade
# ... desenvolver ...
git add .
git commit -m "feat: descrição da funcionalidade"
git push origin feature/nova-funcionalidade

# Pull Request → merge na main → Vercel faz deploy automático
```

### Checklist pré-deploy

- [ ] `npm run build` sem erros localmente
- [ ] Variáveis de ambiente conferidas no Vercel
- [ ] Migrations do banco aplicadas no Supabase
- [ ] Edge Functions implantadas (se alteradas)

---

## 6. Monitoramento

| Serviço | URL |
|---|---|
| Logs Vercel | `vercel.com → Project → Deployments → Logs` |
| Logs Supabase | `supabase.com → Project → Edge Functions → Logs` |
| Banco de dados | `supabase.com → Project → Table Editor` |
| Auth | `supabase.com → Project → Authentication → Users` |

---

## 7. Resumo de URLs importantes

| Recurso | URL |
|---|---|
| Site público | `https://moovifly.com.br` |
| Backoffice | `https://moovifly.com.br/backoffice` |
| Login | `https://moovifly.com.br/backoffice/login` |
| Supabase Studio | `https://supabase.com/dashboard/project/axrkvvjnubjxgejvrbmf` |
| Vercel Dashboard | `https://vercel.com/dashboard` |
| GitHub | `https://github.com/SEU_USUARIO/moovifly` |
