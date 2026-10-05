import type { NextConfig } from 'next';

// Painel só de cliente (tudo no browser, com a sessão do Supabase): pode ir para a Vercel ou para qualquer alojamento estático.
const nextConfig: NextConfig = { output: 'export' };

export default nextConfig;
