import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, useThree, useFrame } from '@react-three/fiber/native';
import { useGLTF } from '@react-three/drei/native';
import * as THREE from 'three';

interface ThumbnailsProps {
  glbUrl: string;
  /** Mesh name to render for the "bolt" thumbnail */
  boltMesh: string;
  /** Mesh name to render for the "leg" thumbnail */
  legMesh: string;
  /** Called once with { bolt, leg } data-URI strings when both are ready */
  onReady: (uris: { bolt: string | null; leg: string | null }) => void;
}

/**
 * Renders the two distinct part shapes (a hanger bolt and a leg) off-screen,
 * captures each to a PNG data-URI once, and reports them back via onReady.
 * The tray then displays these as cheap static <Image> thumbnails instead of
 * placeholder icons.
 *
 * Mount this once (e.g. in AssemblyScreen) inside a tiny hidden View.
 */
export function PartThumbnails({
  glbUrl,
  boltMesh,
  legMesh,
  onReady,
}: ThumbnailsProps) {
  const [done, setDone] = useState(false);

  if (done) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <Canvas
        camera={{ position: [0, 0, 1.2], fov: 35 }}
        gl={{ alpha: true, preserveDrawingBuffer: true }}
        style={{ width: 128, height: 128, backgroundColor: 'transparent' }}
      >
        <ambientLight intensity={0.8} color="#fff2e0" />
        <directionalLight position={[2, 3, 4]} intensity={1.0} color="#ffd9a0" />
        <directionalLight position={[-2, 1, -2]} intensity={0.3} color="#ffcaa0" />
        <React.Suspense fallback={null}>
          <Capturer
            glbUrl={glbUrl}
            boltMesh={boltMesh}
            legMesh={legMesh}
            onReady={(uris) => {
              onReady(uris);
              setDone(true);
            }}
          />
        </React.Suspense>
      </Canvas>
    </View>
  );
}

function Capturer({
  glbUrl,
  boltMesh,
  legMesh,
  onReady,
}: ThumbnailsProps) {
  const { scene: gltf } = useGLTF(glbUrl);
  const { gl, scene, camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const phase = useRef<'bolt' | 'leg' | 'finished'>('bolt');
  const frame = useRef(0);
  const result = useRef<{ bolt: string | null; leg: string | null }>({
    bolt: null,
    leg: null,
  });

  // Build a centered clone of one named mesh, framed to fill the view.
  const buildIsolated = useCallback(
    (meshName: string): THREE.Object3D | null => {
      let found: THREE.Object3D | null = null;
      gltf.traverse((o: THREE.Object3D) => {
        if (o.name === meshName) found = o;
      });
      if (!found) return null;

      const clone = (found as THREE.Object3D).clone(true);
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.visible = true;

      // Center + scale to fit using bounding box
      const box = new THREE.Box3().setFromObject(clone);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      clone.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetSize = 0.8;
      const s = targetSize / maxDim;
      const wrapper = new THREE.Group();
      wrapper.add(clone);
      wrapper.scale.setScalar(s);
      // Slight 3/4 tilt so it reads as 3D
      wrapper.rotation.set(0.4, 0.7, 0);
      return wrapper;
    },
    [gltf]
  );

  useFrame(() => {
    if (phase.current === 'finished' || !groupRef.current) return;

    frame.current += 1;

    // Mount the current part on frame 1 of its phase
    if (frame.current === 1) {
      const name = phase.current === 'bolt' ? boltMesh : legMesh;
      const obj = buildIsolated(name);
      groupRef.current.clear();
      if (obj) groupRef.current.add(obj);
    }

    // Capture a couple frames later so it has rendered
    if (frame.current === 4) {
      try {
        const canvas: any = (gl as any).domElement || (gl as any).canvas;
        if (canvas && canvas.toDataURL) {
          const uri = canvas.toDataURL('image/png');
          if (phase.current === 'bolt') result.current.bolt = uri;
          else result.current.leg = uri;
        }
      } catch (e) {
        // capture not supported; leave null → tray falls back to icons
      }

      if (phase.current === 'bolt') {
        phase.current = 'leg';
        frame.current = 0;
      } else {
        phase.current = 'finished';
        onReady(result.current);
      }
    }
  });

  return <group ref={groupRef} />;
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 128,
    height: 128,
    opacity: 0,
    left: -200, // off-screen
    top: -200,
  },
});