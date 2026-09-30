import { View, type StyleProp, type ViewStyle } from 'react-native';

import { usePalette } from '@/constants/use-palette';
import type { Viatura } from '@/data/categorias';

import { aparencia } from './formas';
import { ModeloCarro } from './modelo';
import { Canvas } from './r3f';

/** Carro genérico em 3D, a rodar devagar, com a forma e a cor da viatura escolhida. */
export function Carro3D({ viatura, style }: { viatura: Viatura; style?: StyleProp<ViewStyle> }) {
  const cores = usePalette();
  const { forma, cor } = aparencia(viatura);

  return (
    <View style={[{ backgroundColor: cores.backgroundElement }, style]}>
      <Canvas camera={{ position: [0, 3.2, 10.5], fov: 30 }} onCreated={({ camera }) => camera.lookAt(0, 0.7, 0)}>
        <hemisphereLight args={['#FFFFFF', '#444444', 1.2]} />
        <directionalLight position={[5, 8, 5]} intensity={2.2} />
        <directionalLight position={[-6, 4, -4]} intensity={0.9} />
        <ModeloCarro key={viatura.id} forma={forma} cor={cor} />
        {/* Sombra suave no chão. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
          <circleGeometry args={[3.2, 48]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.12} />
        </mesh>
      </Canvas>
    </View>
  );
}
