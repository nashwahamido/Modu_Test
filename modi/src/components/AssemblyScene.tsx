import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei/native';
import { useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { AssemblyDefinition, AssemblyStep } from '../data/lackAssembly';
import { useAssemblyStore } from '../store/assemblyStore';

interface SceneProps {
  definition: AssemblyDefinition;
  pointerNDC: React.MutableRefObject<{ x: number; y: number } | null>;
  joystick: React.MutableRefObject<{ x: number; y: number }>;
  cameraOffset: React.MutableRefObject<{ x: number; y: number }>;
}

const GREEN = new THREE.Color('#3ddc84');
const BLUE = new THREE.Color('#4a90ff');
const GHOST_GREEN = new THREE.Color('#00ff88');
const FLASH = new THREE.Color('#ff8a14');

function tintObj(obj: THREE.Object3D, color: THREE.Color): void {
  obj.traverse((o: THREE.Object3D) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
    if (m && m.emissive) {
      m.emissive.copy(color);
      m.emissiveIntensity = 0.6;
    }
  });
}

function clearTintObj(obj: THREE.Object3D): void {
  obj.traverse((o: THREE.Object3D) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
    if (m && m.emissive) {
      m.emissive.setHex(0x000000);
      m.emissiveIntensity = 0;
    }
  });
}

export const AssemblyScene = React.forwardRef<unknown, SceneProps>(
  function AssemblySceneInner(
    { definition, pointerNDC, joystick, cameraOffset },
    ref
  ) {
    const { scene: gltf } = useGLTF(definition.glbUrl);
    const { camera } = useThree();
    const assembly = useRef<THREE.Group>(null);

    const held = useAssemblyStore((s) => s.held);
    const snapState = useAssemblyStore((s) => s.snapState);
    const setSnapState = useAssemblyStore((s) => s.setSnapState);
    const rotationProgress = useAssemblyStore((s) => s.rotationProgress);
    const autoRotate = useAssemblyStore((s) => s.autoRotate);
    const completed = useAssemblyStore((s) => s.completed);
    const zoom = useAssemblyStore((s) => s.zoom);

    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const ghostRef = useRef<THREE.Mesh | null>(null);
    const dismantled = useRef(false);
    const autoZoomRef = useRef(1);
    // When set, the scene smoothly returns to the default centered view
    const resetRequested = useRef(false);

    const originalPositions = useRef<Record<string, THREE.Vector3>>({});
    const originalRotations = useRef<Record<string, THREE.Euler>>({});
    const startOffsets = useRef<Record<string, THREE.Vector3>>({});

    const partMeshes = useMemo(() => {
      const map: Record<string, THREE.Object3D> = {};
      gltf.traverse((o: THREE.Object3D) => {
        if (o.name) map[o.name] = o;
      });
      return map;
    }, [gltf]);

    useEffect(() => {
      if (dismantled.current) return;

      // Realistic-ish material tuning: keep the GLB's own colors/textures
      // but soften the shading response for a warm, cozy feel. We only
      // adjust how the surface reacts to light, not the base color itself.
      gltf.traverse((o: THREE.Object3D) => {
        const mesh = o as THREE.Mesh;
        const m = mesh.material as THREE.MeshStandardMaterial;
        if (m && m.isMeshStandardMaterial) {
          const name = mesh.name.toLowerCase();
          if (name.includes('115980') || name.includes('bolt')) {
            // Metal bolts: brushed, soft sheen (not mirror)
            m.metalness = 0.6;
            m.roughness = 0.45;
          } else {
            // Wood (table top + legs): warm matte, slight warmth in color
            m.metalness = 0.0;
            m.roughness = 0.7;
            if (m.color) m.color.lerp(new THREE.Color('#e9c9a0'), 0.12);
          }
          m.needsUpdate = true;
        }
      });

      definition.steps.forEach((step: AssemblyStep, i: number) => {
        const m = partMeshes[step.meshName];
        if (m) {
          originalPositions.current[step.meshName] = m.position.clone();
          originalRotations.current[step.meshName] = m.rotation.clone();
          const angle = (i / definition.steps.length) * Math.PI * 2;
          const radius = 0.6;
          startOffsets.current[step.meshName] = new THREE.Vector3(
            m.position.x + Math.cos(angle) * radius,
            m.position.y + 0.3,
            m.position.z + Math.sin(angle) * radius
          );
          m.visible = false;
        }
      });
      definition.baseMeshNames.forEach((name: string) => {
        const m = partMeshes[name];
        if (m) m.visible = true;
      });
      dismantled.current = true;
    }, [definition, partMeshes]);

    const stepById = useMemo(() => {
      const m: Record<string, AssemblyStep> = {};
      definition.steps.forEach((s: AssemblyStep) => {
        m[s.id] = s;
      });
      return m;
    }, [definition]);

    useFrame(() => {
      if (!assembly.current) return;
      const a = assembly.current;

      const focusing = autoRotate && !!held;

      // ---- Camera ----
      if (focusing) {
        const step = stepById[held!.stepId];
        const origPos = step ? originalPositions.current[held!.meshName] : null;
        autoZoomRef.current += (3.2 - autoZoomRef.current) * 0.1;
        camera.position.z = 2.0 / autoZoomRef.current;
        if (origPos) {
          const socketLocal = new THREE.Vector3(origPos.x, 0.176, origPos.z);
          const worldTarget = new THREE.Vector3();
          if (partMeshes[held!.meshName]?.parent) {
            partMeshes[held!.meshName].parent!.localToWorld(
              worldTarget.copy(socketLocal)
            );
          }
          camera.position.x += (worldTarget.x - camera.position.x) * 0.08;
          camera.position.y += (worldTarget.y + 0.2 - camera.position.y) * 0.08;
          camera.lookAt(worldTarget);
        }
      } else {
        autoZoomRef.current = zoom;
        camera.position.z = 2.0 / zoom;
        camera.position.x = cameraOffset.current.x;
        camera.position.y = 0.2 + cameraOffset.current.y;
        camera.lookAt(cameraOffset.current.x, cameraOffset.current.y, -1);
      }

      // ---- Assembly orientation ----
      const j = joystick.current;

      if (focusing) {
        const step = stepById[held!.stepId];
        const origPos = step ? originalPositions.current[held!.meshName] : null;
        if (origPos) {
          const targetYaw = Math.atan2(origPos.x, origPos.z) + Math.PI;
          let diff = targetYaw - a.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          a.rotation.y += diff * 0.1;
          a.rotation.x += (-0.9 - a.rotation.x) * 0.1;
          a.position.y += (-0.15 - a.position.y) * 0.1;
        }
      } else if (resetRequested.current || completed) {
        // Smoothly return to the default upright, centered view
        a.rotation.x += (0 - a.rotation.x) * 0.12;
        a.rotation.y += (0 - a.rotation.y) * 0.12;
        a.position.x += (0 - a.position.x) * 0.12;
        a.position.y += (0 - a.position.y) * 0.12;
        a.position.z += (0 - a.position.z) * 0.12;
        if (
          Math.abs(a.rotation.x) < 0.01 &&
          Math.abs(a.rotation.y) < 0.01 &&
          Math.abs(a.position.y) < 0.01
        ) {
          resetRequested.current = false;
        }
      } else {
        a.position.y += (0 - a.position.y) * 0.1;
        if (Math.abs(j.x) > 0.01 || Math.abs(j.y) > 0.01) {
          a.rotation.y += j.x * 0.06;
          a.rotation.x = THREE.MathUtils.clamp(
            a.rotation.x + j.y * 0.04,
            -Math.PI,
            Math.PI
          );
        }
      }

      // ---- Held part handling ----
      if (!held) {
        hideGhost();
        return;
      }

      const step = stepById[held.stepId];
      const partMesh = partMeshes[held.meshName];
      if (!step || !partMesh) return;

      const origPos = originalPositions.current[held.meshName];
      const startPos = startOffsets.current[held.meshName];
      if (!origPos || !partMesh.parent) return;

      partMesh.visible = true;

      if (snapState === 'screwing') {
        const origRot = originalRotations.current[held.meshName];
        if (origRot) {
          partMesh.rotation.copy(origRot);
          partMesh.rotateOnWorldAxis(
            new THREE.Vector3(0, 1, 0),
            rotationProgress * Math.PI * 4
          );
        }
        const driveDist = 0.03 * (1 - rotationProgress);
        partMesh.position.set(origPos.x, origPos.y - driveDist, origPos.z);
        if (rotationProgress > 0.8) tintObj(partMesh, GREEN);
        else tintObj(partMesh, BLUE);
        hideGhost();
        return;
      }

      showGhostAtOriginal(origPos, partMesh);

      const ndc = pointerNDC.current;
      if (ndc) {
        const targetWorld = new THREE.Vector3();
        partMesh.parent.localToWorld(targetWorld.copy(origPos));
        const planeNormal = camera.position.clone().sub(targetWorld).normalize();
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          planeNormal,
          targetWorld
        );
        raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        const hit = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, hit);
        if (hit) {
          const localHit = partMesh.parent.worldToLocal(hit);
          partMesh.position.copy(localHit);
          const dist = partMesh.position.distanceTo(origPos);
          if (dist < 0.12) {
            setSnapState('near_correct');
            tintObj(partMesh, GREEN);
          } else if (dist < 0.3) {
            setSnapState('near_rotation');
            tintObj(partMesh, BLUE);
          } else {
            setSnapState('held');
            clearTintObj(partMesh);
          }
        }
      } else if (startPos) {
        partMesh.position.copy(startPos);
        const origRot = originalRotations.current[held.meshName];
        if (origRot) partMesh.rotation.copy(origRot);
        setSnapState('held');
        clearTintObj(partMesh);
      }
    });

    function showGhostAtOriginal(
      origPos: THREE.Vector3,
      partMesh: THREE.Object3D
    ): void {
      const parent = partMesh.parent;
      if (!parent) return;
      if (!ghostRef.current) {
        const geo = new THREE.SphereGeometry(0.04, 16, 16);
        const mat = new THREE.MeshStandardMaterial({
          color: GHOST_GREEN,
          transparent: true,
          opacity: 0.8,
          emissive: GHOST_GREEN,
          emissiveIntensity: 1.0,
        });
        const ghost = new THREE.Mesh(geo, mat);
        ghost.name = '__ghost';
        parent.add(ghost);
        ghostRef.current = ghost;
      }
      if (ghostRef.current.parent !== parent) {
        ghostRef.current.removeFromParent();
        parent.add(ghostRef.current);
      }
      const SOCKET_Y = 0.176;
      ghostRef.current.position.set(origPos.x, SOCKET_Y, origPos.z);
      ghostRef.current.visible = true;
      const t = Date.now() * 0.004;
      ghostRef.current.scale.setScalar(1 + 0.3 * Math.sin(t));
    }

    function hideGhost(): void {
      if (ghostRef.current) ghostRef.current.visible = false;
    }

    function hidePartMesh(meshName: string): void {
      const m = partMeshes[meshName];
      if (m) {
        m.visible = false;
        clearTintObj(m);
        const orig = originalPositions.current[meshName];
        if (orig) m.position.copy(orig);
        const origRot = originalRotations.current[meshName];
        if (origRot) m.rotation.copy(origRot);
      }
      hideGhost();
    }

    function commitSnap(step: AssemblyStep): void {
      const partMesh = partMeshes[step.meshName];
      if (!partMesh) return;
      const orig = originalPositions.current[step.meshName];
      if (orig) partMesh.position.copy(orig);
      const origRot = originalRotations.current[step.meshName];
      if (origRot) partMesh.rotation.copy(origRot);
      clearTintObj(partMesh);
      hideGhost();
      flashAssembly();
    }

    function flashAssembly(): void {
      if (!assembly.current) return;
      assembly.current.traverse((o: THREE.Object3D) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m && m.emissive) {
          m.emissive.copy(FLASH);
          m.emissiveIntensity = 0.5;
        }
      });
      setTimeout(() => {
        assembly.current?.traverse((o: THREE.Object3D) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m && m.emissive) {
            m.emissive.setHex(0x000000);
            m.emissiveIntensity = 0;
          }
        });
      }, 900);
    }

    function resetView(): void {
      // Request a smooth return to the default centered/upright view.
      resetRequested.current = true;
      autoZoomRef.current = 1;
      // Snap the camera to the default framing immediately so the table
      // isn't left low/off-screen from a previous auto-view aim.
      camera.position.set(0, 0.2, 2.0);
      camera.lookAt(0, 0, -1);
      if (assembly.current) {
        assembly.current.position.set(0, 0, 0);
      }
    }

    React.useImperativeHandle(ref, () => ({
      commitSnap,
      hidePartMesh,
      resetView,
    }));

    return (
      <group ref={assembly}>
        <primitive object={gltf} />
        {/* Soft warm under-fill so the underside reads cozy, not black */}
        <directionalLight position={[0, -3, 1]} intensity={0.35} color="#f0c79a" />
      </group>
    );
  }
);