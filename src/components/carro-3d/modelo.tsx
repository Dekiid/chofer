import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { Forma } from './formas';
import { useFrame } from './r3f';

/** Silhueta lateral da carroçaria até à linha de cintura, com capô e mala. */
function perfilCarrocaria(f: Forma): THREE.Shape {
  const L = f.comprimento / 2;
  const s = new THREE.Shape();
  s.moveTo(-L, f.alturaChao + 0.05);
  s.lineTo(-L - 0.03, f.alturaCintura - 0.2);
  s.quadraticCurveTo(-L, f.alturaCintura - 0.05, -L + 0.25, f.alturaCintura - 0.02);
  s.lineTo(L - 0.25, f.alturaCintura);
  s.quadraticCurveTo(L, f.alturaCintura - 0.03, L + 0.02, f.alturaCintura - 0.25);
  s.lineTo(L, f.alturaChao + 0.05);
  s.lineTo(-L, f.alturaChao + 0.05);
  return s;
}

/** Silhueta da cabine (vidros) entre a cintura e o tejadilho. */
function perfilCabine(f: Forma): THREE.Shape {
  const x = (t: number) => -f.comprimento / 2 + t * f.comprimento;
  const s = new THREE.Shape();
  s.moveTo(x(f.fimCapo), f.alturaCintura);
  s.lineTo(x(f.fimCapo + 0.14), f.alturaTejadilho);
  s.lineTo(x(f.inicioTraseira), f.alturaTejadilho);
  s.lineTo(x(f.fimTraseira), f.alturaCintura);
  s.lineTo(x(f.fimCapo), f.alturaCintura);
  return s;
}

function Roda({ x, z, raio }: { x: number; z: number; raio: number }) {
  return (
    <group position={[x, raio, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[raio, raio, 0.26, 32]} />
        <meshStandardMaterial color="#141414" roughness={0.9} />
      </mesh>
      <mesh position={[0, z > 0 ? 0.145 : -0.145, 0]}>
        <cylinderGeometry args={[raio * 0.62, raio * 0.62, 0.02, 24]} />
        <meshStandardMaterial color="#B5B8BD" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

export function ModeloCarro({ forma: f, cor }: { forma: Forma; cor: string }) {
  const grupo = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (grupo.current) grupo.current.rotation.y += dt * 0.35;
  });

  const carrocaria = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(perfilCarrocaria(f), {
      depth: f.largura, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 4, curveSegments: 12,
    });
    g.translate(0, 0, -f.largura / 2);
    return g;
  }, [f]);

  const larguraCabine = f.largura - 0.22;
  const cabine = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(perfilCabine(f), {
      depth: larguraCabine, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3,
    });
    g.translate(0, 0, -larguraCabine / 2);
    return g;
  }, [f, larguraCabine]);

  const L = f.comprimento / 2;
  const eixoFrente = -L + f.comprimento * 0.19;
  const eixoTras = L - f.comprimento * 0.19;
  const zRoda = f.largura / 2 - 0.05;
  const xTejadilho = -L + f.comprimento * (f.fimCapo + 0.14);
  const comprimentoTejadilho = f.comprimento * (f.inicioTraseira - f.fimCapo - 0.14);

  return (
    <group ref={grupo} rotation={[0, -0.6, 0]}>
      <mesh geometry={carrocaria}>
        <meshStandardMaterial color={cor} metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh geometry={cabine}>
        <meshStandardMaterial color="#0C0F14" metalness={0.8} roughness={0.08} transparent opacity={0.92} />
      </mesh>
      {/* Tejadilho pintado por cima dos vidros. */}
      <mesh position={[xTejadilho + comprimentoTejadilho / 2, f.alturaTejadilho + 0.04, 0]}>
        <boxGeometry args={[comprimentoTejadilho, 0.05, larguraCabine + 0.02]} />
        <meshStandardMaterial color={cor} metalness={0.55} roughness={0.28} />
      </mesh>
      {/* Faróis e farolins. */}
      {[-1, 1].map((lado) => (
        <group key={lado}>
          <mesh position={[-L - 0.1, f.alturaCintura - 0.18, lado * (f.largura / 2 - 0.25)]}>
            <boxGeometry args={[0.06, 0.1, 0.42]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFF4D6" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[L + 0.1, f.alturaCintura - 0.2, lado * (f.largura / 2 - 0.25)]}>
            <boxGeometry args={[0.06, 0.1, 0.42]} />
            <meshStandardMaterial color="#8A0F12" emissive="#C0161B" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
      <Roda x={eixoFrente} z={zRoda} raio={f.raioRoda} />
      <Roda x={eixoFrente} z={-zRoda} raio={f.raioRoda} />
      <Roda x={eixoTras} z={zRoda} raio={f.raioRoda} />
      <Roda x={eixoTras} z={-zRoda} raio={f.raioRoda} />
    </group>
  );
}
