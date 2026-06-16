import React, { Suspense } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import { useGLTF } from '@react-three/drei/native';
import * as THREE from 'three';
import { AssemblyDefinition, AssemblyStep } from '../../data/lackAssembly';
import { useAssemblyStore } from '../../store/assemblyStore';

interface TrayProps {
  definition: AssemblyDefinition;
  onPressPart: (step: AssemblyStep, screenX: number, screenY: number) => void;
}

export function PartTray({ definition, onPressPart }: TrayProps) {
  const statuses = useAssemblyStore((s) => s.statuses);
  const focusMode = useAssemblyStore((s) => s.focusMode);

  const visibleSteps = focusMode
    ? definition.steps.filter((s: AssemblyStep) => statuses[s.id] === 'pending')
    : definition.steps;

  return (
    <View style={styles.tray} pointerEvents="box-none">
      {focusMode && <Text style={styles.focusLabel}>FOCUS</Text>}
      {visibleSteps.map((step: AssemblyStep) => {
        const status = statuses[step.id];
        const disabled = status !== 'pending';
        return (
          <Pressable
            key={step.id}
            disabled={disabled}
            onPressIn={(e) =>
              onPressPart(step, e.nativeEvent.pageX, e.nativeEvent.pageY)
            }
            style={[
              styles.chip,
              status === 'done' && styles.chipDone,
              status === 'locked' && styles.chipLocked,
              status === 'pending' && styles.chipActive,
            ]}
          >
            <View style={styles.preview}>
              <Canvas camera={{ position: [0, 0, 1.6], fov: 40 }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[2, 3, 2]} intensity={0.8} />
                <Suspense fallback={null}>
                  <PartPreview
                    glbUrl={definition.glbUrl}
                    meshName={step.meshName}
                  />
                </Suspense>
              </Canvas>
            </View>
            <Text style={styles.partLabel}>{step.label}</Text>
            <Text style={styles.partNo}>#{step.partNumber}</Text>
            {status === 'done' && <Text style={styles.check}>✓</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

function PartPreview({
  glbUrl,
  meshName,
}: {
  glbUrl: string;
  meshName: string;
}) {
  const { scene } = useGLTF(glbUrl);
  const source = scene.getObjectByName(meshName) as THREE.Mesh | undefined;
  if (!source) return null;
  const clone = source.clone();
  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = 0.9 / Math.max(size.x, size.y, size.z);
  clone.position.set(0, 0, 0);
  clone.scale.setScalar(scale);
  return <SpinningPart object={clone} />;
}

function SpinningPart({ object }: { object: THREE.Object3D }) {
  const ref = React.useRef<THREE.Group>(null);
  React.useEffect(() => {
    let raf: number;
    const tick = () => {
      if (ref.current) ref.current.rotation.y += 0.02;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <group ref={ref}>
      <primitive object={object} />
    </group>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  focusLabel: {
    color: '#64b4ff',
    fontSize: 9,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '700',
  },
  chip: {
    width: 76,
    height: 80,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipActive: {
    borderColor: 'rgba(100,160,255,0.7)',
    backgroundColor: 'rgba(100,160,255,0.15)',
  },
  chipDone: {
    borderColor: 'rgba(60,220,130,0.5)',
    backgroundColor: 'rgba(60,220,130,0.12)',
  },
  chipLocked: { opacity: 0.35 },
  preview: { width: 60, height: 48 },
  partLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 9, marginTop: 1 },
  partNo: { color: 'rgba(255,255,255,0.4)', fontSize: 8 },
  check: {
    position: 'absolute',
    top: 4,
    right: 6,
    color: '#3ddc84',
    fontSize: 14,
  },
});