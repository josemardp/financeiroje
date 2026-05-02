# INSTALAÇÃO DO MANUAL INTERATIVO — 3 PASSOS

**Tempo total:** 10–15 minutos
**Requisito:** ter o projeto FinanceiroJe já configurado no Supabase (você já tem)

---

## PASSO 1 — Aplicar Migration no Supabase (3 min)

1. Abra o **Supabase Dashboard** do FinanceiroJe (`https://supabase.com/dashboard`)
2. Selecione o projeto do FinanceiroJe
3. No menu lateral, clique em **SQL Editor**
4. Clique em **+ New query**
5. Abra o arquivo `migration.sql` (que está no pacote)
6. **Copie todo o conteúdo** e cole no SQL Editor
7. Clique em **Run** (canto inferior direito ou Ctrl+Enter)
8. Aguarde aparecer: `Migration aplicada com sucesso. Tabelas criadas: manual_30_dias_progresso, manual_30_dias_decisoes`

✅ Pronto. Banco preparado.

---

## PASSO 2 — Configurar credenciais no HTML (2 min)

1. Abra o arquivo `manual_30_dias_app.html` em qualquer editor de texto (VS Code, Notepad++, ou até bloco de notas)

2. Localize estas duas linhas (ficam por volta da linha 800):
   ```javascript
   const SUPABASE_URL = 'COLE_AQUI_SUA_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_SUPABASE_ANON_KEY';
   ```

3. Vá no Supabase Dashboard → **Project Settings** → **API**

4. Você verá duas informações:
   - **Project URL** (algo como `https://xxxxx.supabase.co`) → cole no `SUPABASE_URL`
   - **anon public key** (uma chave longa) → cole no `SUPABASE_ANON_KEY`

5. **Salve o arquivo.**

⚠️ **A `anon key` é segura para ser pública** — é a mesma que você usa no FinanceiroJe deployado no Vercel. NÃO confunda com a `service_role` key (essa é secreta — não use!).

✅ Pronto. HTML configurado.

---

## PASSO 3 — Hospedar (5 min)

Você tem **3 opções**, da mais simples para a mais robusta:

### Opção A — Abrir local + sincronizar via Drive (mais simples)

1. Coloque o arquivo `manual_30_dias_app.html` no Google Drive
2. Em casa: abre direto pelo Drive (clica → abre no navegador)
3. No quartel: mesma coisa
4. **Os dados de checklist sincronizam via Supabase** — não importa onde você abriu, o estado está sempre atualizado

❌ Limitação: precisa baixar o arquivo cada vez que abre. Funciona mas é meio chato.

### Opção B — Vercel Drag & Drop (recomendado, 2 min)

1. Acesse `https://vercel.com/new`
2. Login com sua conta (mesma do FinanceiroJe)
3. Vá em **"Deploy a static site"** → arraste o arquivo `manual_30_dias_app.html` para a página
4. Renomeie para `index.html` se pedir
5. Aguarde 30 segundos → você recebe uma URL tipo `manual-esdra-xxx.vercel.app`
6. Bookmark essa URL no celular, PC de casa e PC do quartel
7. **Funciona em qualquer dispositivo, sem instalar nada**

✅ Recomendado.

### Opção C — Subir como subprojeto do FinanceiroJe (mais técnico)

1. Cria pasta `public/manual` no repo do FinanceiroJe
2. Coloca o HTML lá como `index.html`
3. Acesso via `https://seu-financeiroje.vercel.app/manual/`

❌ Complica deploy. Use só se você for muito organizado.

---

## PASSO 4 — Primeiro acesso (2 min)

1. Abra a URL (ou arquivo) no navegador
2. Digite seu email
3. Clique em **"Receber link de acesso"**
4. Vá no seu email, abra o link mágico do Supabase
5. Você é redirecionado para o app já logado
6. **Pronto.** Você está no Dia 1.

⚠️ **Importante:** o link mágico é válido por algumas horas. Se expirar, peça outro.

---

## TESTANDO TUDO

Faça este checklist na primeira vez:

- [ ] Login funciona em casa
- [ ] Login funciona no celular
- [ ] Marca uma tarefa como cumprida
- [ ] Abre em outro dispositivo → tarefa aparece marcada (sincronizou)
- [ ] Escreve algo na Decisão da Semana 1 (Dia 8) → aguarda 1 segundo → vê "salvo automaticamente"
- [ ] Fecha e reabre → texto da decisão ainda lá
- [ ] Clica em "Hoje" → vai para o dia atual
- [ ] Setas ← → navegam entre dias

Se todos os itens funcionam: ✅ tá redondo.

---

## PROBLEMAS COMUNS

**"Configuração Supabase não preenchida"**
→ Você esqueceu de colar URL/key no HTML. Refaça PASSO 2.

**"Erro: invalid email"**
→ Email digitado errado.

**"Não recebo o link mágico"**
→ Olha no spam. Se nada, vai no Supabase Dashboard → Authentication → Email Templates e confirma que está ativo.

**"Marquei tarefa em casa, não aparece marcada no quartel"**
→ Você logou com email diferente? O sistema vincula tudo por email. Tem que ser sempre o mesmo email.

**"Site travou em 'carregando…'"**
→ Provavelmente sua internet caiu na hora do checkAuth. Recarrega a página.

---

## SEGURANÇA

- Os dados ficam no **seu** Supabase, na **sua** conta. Não passam por mim, não passam pela Anthropic, não passam por terceiros.
- Cada tarefa marcada e cada decisão escrita são registradas com `user_id` — apenas você vê seus dados (RLS ativo).
- A `anon key` é segura para ser pública (é o padrão do Supabase).
- Pode usar este sistema por anos sem problema. Se quiser apagar tudo um dia, é só dropar as 2 tabelas.

---

*Pronto para começar amanhã. Sem ansiedade. Pequeno, completo, cumprido.*
