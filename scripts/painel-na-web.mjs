// Junta o painel de gestão (pasta painel/) ao site web da app, em /painel.
// Corre depois de "expo export -p web" (npm run build:web), também no Cloudflare.
// O painel usa as mesmas variáveis da app (EXPO_PUBLIC_SUPABASE_*), por isso não precisa de variáveis próprias.
// Se o painel falhar, a app publica-se na mesma: o erro só aparece no registo da build.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';

const painel = new URL('../painel/', import.meta.url).pathname;
const destino = new URL('../dist/painel/', import.meta.url).pathname;

try {
  if (!existsSync(`${painel}node_modules`)) execSync('npm ci --no-audit --no-fund', { cwd: painel, stdio: 'inherit' });
  execSync('npx next build', {
    cwd: painel,
    stdio: 'inherit',
    env: {
      ...process.env,
      PAINEL_BASE: '/painel',
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  });
  rmSync(destino, { recursive: true, force: true });
  cpSync(`${painel}out`, destino, { recursive: true });
  console.log('Painel copiado para dist/painel (abre em /painel).');
} catch (e) {
  console.warn('O painel não foi incluído no site:', e instanceof Error ? e.message : e);
}
