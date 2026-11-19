/** Lê uma data escrita como DD/MM/AAAA. Devolve null se não for uma data real. */
export function lerData(texto: string): Date | null {
  const m = texto.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const [d, mes, ano] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const data = new Date(ano, mes, d, 23, 59);
  return data.getDate() === d && data.getMonth() === mes ? data : null;
}

/** Data como DD/MM/AAAA. */
export function formatarData(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Vai pondo as barras enquanto se escreve a data. */
export function mascaraData(texto: string): string {
  const n = texto.replace(/\D/g, '').slice(0, 8);
  return [n.slice(0, 2), n.slice(2, 4), n.slice(4)].filter(Boolean).join('/');
}

/** 135 → «2 h 15 min». */
export function duracaoTexto(min: number): string {
  const h = Math.floor(min / 60);
  const r = min % 60;
  return h > 0 ? `${h} h ${String(r).padStart(2, '0')} min` : `${r} min`;
}
