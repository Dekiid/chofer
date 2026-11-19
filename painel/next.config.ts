import type { NextConfig } from 'next';

// Painel só de cliente (tudo no browser, com a sessão do Supabase): pode ir para a Vercel ou para qualquer alojamento estático.
// PAINEL_BASE=/painel quando vai junto com o site da app (scripts/painel-na-web.mjs).
const nextConfig: NextConfig = { output: 'export', basePath: process.env.PAINEL_BASE || undefined };

export default nextConfig;
