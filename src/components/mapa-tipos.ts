export type Ponto = { latitude: number; longitude: number };

export type MapaProps = {
  origem?: Ponto;
  destino?: Ponto | null;
  carro?: Ponto | null;
  /** Altura do painel por baixo do mapa, para o enquadramento não ficar tapado. */
  margemInferior?: number;
};
