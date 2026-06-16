import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { ToolKind } from '../../data/lackAssembly';

interface ToolProps {
  kind: ToolKind;
  position: [number, number, number];
  active: boolean;
  onDone?: () => void;
}

export function Tool({ kind, position, active, onDone }: ToolProps) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const finished = useRef(false);

  const duration = kind === 'hammer' ? 1.1 : 1.4;

  useFrame((_state, dt) => {
    if (!active || !group.current || finished.current) return;
    elapsed.current += dt;
    const t = elapsed.current;
    const g = group.current;

    if (kind === 'screwdriver') {
      g.rotation.y += dt * 9;
      g.position.y = position[1] + 0.18 - Math.min(t / duration, 1) * 0.06;
    } else if (kind === 'allen_key') {
      g.rotation.y = Math.floor(t * 4) * (Math.PI / 2);
      g.position.y = position[1] + 0.16 - Math.min(t / duration, 1) * 0.05;
    } else if (kind === 'hammer') {
      const strike = Math.abs(Math.sin(t * Math.PI * 2.2));
      g.position.y = position[1] + 0.28 - strike * 0.22;
      g.rotation.z = -0.5 + strike * 0.5;
    }

    if (t >= duration && !finished.current) {
      finished.current = true;
      onDone?.();
    }
  });

  if (kind === 'hand' || !active) return null;

  return (
    <group ref={group} position={position}>
      {kind === 'screwdriver' && <ScrewdriverMesh />}
      {kind === 'allen_key' && <AllenKeyMesh />}
      {kind === 'hammer' && <HammerMesh />}
    </group>
  );
}

function ScrewdriverMesh() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.16, 12]} />
        <meshStandardMaterial color="#e0492b" roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.16, 8]} />
        <meshStandardMaterial color="#bcbcc4" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <coneGeometry args={[0.01, 0.03, 6]} />
        <meshStandardMaterial color="#9a9aa2" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function AllenKeyMesh() {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.14, 6]} />
        <meshStandardMaterial color="#8a8a92" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0.04, -0.07, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.08, 6]} />
        <meshStandardMaterial color="#8a8a92" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

function HammerMesh() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.014, 0.016, 0.22, 10]} />
        <meshStandardMaterial color="#7a4a28" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.1, 12]} />
        <meshStandardMaterial color="#4a4a52" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}