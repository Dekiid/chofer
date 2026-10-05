export type Ponto = { latitude: number; longitude: number };

/** Zona do mapa de procura do motorista: quanto mais forte, mais pedidos. */
export type ZonaMapa = { ponto: Ponto; raioM: number; nivel: number };

export type MapaProps = {
  /** Mapa de procura (só no modo motorista). */
  zonas?: ZonaMapa[];
  origem?: Ponto;
  destino?: Ponto | null;
  /** Paragens pelo caminho, entre a recolha e o destino. */
  paragens?: Ponto[];
  carro?: Ponto | null;
  /** Linha da rota; por omissão liga a recolha ao destino. Com o motorista a caminho, liga o carro à recolha. */
  rota?: Ponto[];
  /** Com o carro a andar, o mapa acompanha-o: enquadra o carro e o resto da rota, como na Uber. */
  seguirCarro?: boolean;
  /** Altura do painel por baixo do mapa, para o enquadramento não ficar tapado. */
  margemInferior?: number;
  /** Com estas funções, os marcadores podem ser arrastados (mantém o dedo e arrasta) para acertar o local. */
  onMoverOrigem?: (p: Ponto) => void;
  onMoverDestino?: (p: Ponto) => void;
  onMoverParagem?: (i: number, p: Ponto) => void;
};
