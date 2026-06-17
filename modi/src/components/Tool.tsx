import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { ToolKind } from '../data/lackAssembly';

interface ToolProps {
  kind: ToolKind;
  position: [number, number, number];
  active: boolean;
  onDone?: () => void;
}

/**
 * Animated tool that plays after a part is snapped.
 * Screwdriver: rotates and screws downward over 3 seconds.
 * Hand (for legs): no tool shown.
 */
export function Tool({ kind, position, active, onDone }: ToolProps) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const finished = useRef(false);

  // Reset when tool becomes active
  useFrame((_state, dt) => {
    if (!active || !group.current) return;

    if (finished.current) return;

    elapsed.current += dt;
    const t = elapsed.current;
    const g = group.current;
    const duration = 3.0; // 3 seconds animation

    if (kind === 'screwdriver') {
      const progress = Math.min(t / duration, 1);
      // Rotate continuously (screwing motion)
      g.rotation.y += dt * 8;
      // Move downward as it screws in
      g.position.y = position[1] + 0.2 * (1 - progress);
      // Slight wobble for realism
      g.rotation.z = Math.sin(t * 6) * 0.05;
    } else if (kind === 'allen_key') {
      const progress = Math.min(t / duration, 1);
      g.rotation.y = Math.floor(t * 3) * (Math.PI / 2);
      g.position.y = position[1] + 0.18 * (1 - progress);
    } else if (kind === 'hammer') {
      const strike = Math.abs(Math.sin(t * Math.PI * 2));
      g.position.y = position[1] + 0.25 - strike * 0.2;
      g.rotation.z = -0.4 + strike * 0.4;
    }

    if (t >= duration && !finished.current) {
      finished.current = true;
      // Reset for next use
      elapsed.current = 0;
      onDone?.();
    }
  });

  // Reset finished flag when becoming active again
  if (active && finished.current) {
    finished.current = false;
    elapsed.current = 0;
  }

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
      {/* Handle */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.032, 0.028, 0.18, 12]} />
        <meshStandardMaterial color="#e0492b" roughness={0.35} />
      </mesh>
      {/* Handle grip lines */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.034, 0.034, 0.02, 12]} />
        <meshStandardMaterial color="#c03020" roughness={0.4} />
      </mesh>
      {/* Shaft */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.18, 8]} />
        <meshStandardMaterial color="#c0c0c8" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Tip */}
      <mesh position={[0, -0.1, 0]}>
        <coneGeometry args={[0.012, 0.04, 6]} />
        <meshStandardMaterial color="#909098" metalness={0.8} roughness={0.25} />
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