export type Ponto = { latitude: number; longitude: number };

export type MapaProps = {
  origem?: Ponto;
  destino?: Ponto | null;
  carro?: Ponto | null;
  /** Linha da rota; por omissão liga a recolha ao destino. Com o motorista a caminho, liga o carro à recolha. */
  rota?: Ponto[];
  /** Altura do painel por baixo do mapa, para o enquadramento não ficar tapado. */
  margemInferior?: number;
};
