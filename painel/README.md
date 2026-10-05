# Chauffeur · Painel de gestão (web)

Painel para a equipa, fora da app: resumo do dia e da semana (viagens, faturação, comissão de 14%),
viagens, motoristas e carros (aprovar ou rejeitar, acertar o preço por km), reservas, avaliações e pedidos de ajuda
(responder e devolver dinheiro). Usa o mesmo projeto Supabase da app.

## Preparar o Supabase (uma vez)

1. SQL Editor > New query: colar `supabase/painel.sql` (na raiz do repositório) e Run.
   Para a partilha por link, fazer o mesmo com `supabase/partilhas.sql`.
2. Authentication > Users > Add user: criar a tua conta com email e palavra-passe.
3. No SQL Editor, juntar esse email aos administradores:

   ```sql
   insert into public.administradores (email) values ('o-teu-email@exemplo.com') on conflict do nothing;
   ```

## Correr no computador

```bash
cd painel
cp .env.local.example .env.local   # e preencher com o endereço e a chave anon do Supabase
npm install
npm run dev                        # abre em http://localhost:3000
```

Sem o `.env.local`, o botão "Ver com dados de exemplo" mostra o painel com dados inventados.

## Pôr na internet

O painel é só HTML e JavaScript (`npm run build` cria a pasta `out/`). O mais simples é a Vercel:
importar o repositório, escolher a pasta `painel` como Root Directory e pôr as duas variáveis
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em Environment Variables.

Nunca pôr a chave service_role aqui: o painel corre no browser.
