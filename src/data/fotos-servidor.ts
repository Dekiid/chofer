import { supabase } from './tempo-real';

// Fotos guardadas no Supabase Storage (supabase/fotos.sql): as das inscrições e as selfies dos motoristas.
// Os baldes são privados: a app só envia; só o painel (administradores) as vê.
export type Balde = 'inscricoes' | 'selfies';

/** Envia a foto do telemóvel para o servidor e devolve o caminho, ou null se não houver servidor ou falhar. */
export async function enviarFoto(balde: Balde, caminho: string, uri: string): Promise<string | null> {
  const sb = supabase();
  if (!sb || !uri) return null;
  try {
    const resposta = await fetch(uri);
    const dados = await resposta.arrayBuffer();
    const tipo = resposta.headers.get('content-type')?.startsWith('image/') ? resposta.headers.get('content-type')! : 'image/jpeg';
    const { error } = await sb.storage.from(balde).upload(caminho, dados, { contentType: tipo, upsert: false });
    if (error) {
      console.warn('Foto não enviada', balde, caminho, error.message);
      return null;
    }
    return caminho;
  } catch (e) {
    console.warn('Foto não enviada', balde, caminho, String(e));
    return null;
  }
}

/** Envia várias fotos para a mesma pasta; devolve só as que chegaram, pelo mesmo nome. */
export async function enviarFotos<K extends string>(balde: Balde, pasta: string, fotos: Partial<Record<K, string>>): Promise<Partial<Record<K, string>>> {
  const entradas = Object.entries(fotos).filter(([, uri]) => Boolean(uri)) as [K, string][];
  const enviadas = await Promise.all(entradas.map(async ([nome, uri]) => [nome, await enviarFoto(balde, `${pasta}/${nome}.jpg`, uri)] as const));
  return Object.fromEntries(enviadas.filter(([, caminho]) => caminho)) as Partial<Record<K, string>>;
}
