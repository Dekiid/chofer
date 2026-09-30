# Supabase

Pagamentos pela DebitoPay (M-Pesa e e-Mola). O cliente paga antes; a viagem só fica confirmada quando o pagamento está `pago`.

- `migrations/`: tabelas `pagamentos` (com a comissão de 14% e a parte do motorista por viagem) e `pagamentos_eventos`.
- `functions/criar-pagamento`: regista o pagamento e envia o pedido ao telemóvel do cliente.
- `functions/estado-pagamento`: estado para a app; consulta a DebitoPay se o webhook tardar.
- `functions/webhook-debitopay`: recebe `payment.completed` / `payment.failed`, validados por HMAC-SHA256.

Segredos (Edge Functions, nunca no repositório): `DEBITOPAY_API_KEY`, `DEBITOPAY_MERCHANT_ID`, `DEBITOPAY_WALLET_MPESA`, `DEBITOPAY_WALLET_EMOLA`, `DEBITOPAY_WEBHOOK_SECRET`.

Na app, `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`. Sem elas o pagamento é simulado.

```bash
npx supabase db push
npx supabase secrets set DEBITOPAY_API_KEY=... DEBITOPAY_MERCHANT_ID=... DEBITOPAY_WALLET_MPESA=... DEBITOPAY_WALLET_EMOLA=... DEBITOPAY_WEBHOOK_SECRET=...
npx supabase functions deploy criar-pagamento estado-pagamento webhook-debitopay
```
