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
    const zoom = useAssemblyStore((s) => s.zoom);

    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const ghostRef = useRef<THREE.Mesh | null>(null);
    const dismantled = useRef(false);
    const autoZoomRef = useRef(1);

    const originalPositions = useRef<Record<string, THREE.Vector3>>({});
    const originalRotations = useRef<Record<string, THREE.Euler>>({});
    // Offset start positions (away from target)
    const startOffsets = useRef<Record<string, THREE.Vector3>>({});

    const partMeshes = useMemo(() => {
      const map: Record<string, THREE.Object3D> = {};
      gltf.traverse((o: THREE.Object3D) => {
        if (o.name) map[o.name] = o;
      });
      return map;
    }, [gltf]);

    // Record originals, generate random start offsets, dismantle
    useEffect(() => {
      if (dismantled.current) return;
      definition.steps.forEach((step: AssemblyStep, i: number) => {
        const m = partMeshes[step.meshName];
        if (m) {
          originalPositions.current[step.meshName] = m.position.clone();
          originalRotations.current[step.meshName] = m.rotation.clone();
          // Generate offset: place parts spread out to the side
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

      // Camera — strong auto-zoom + recenter on the focused hole
      if (autoRotate && held) {
        const step = stepById[held.stepId];
        const origPos = step ? originalPositions.current[held.meshName] : null;
        // Zoom in close
        autoZoomRef.current += (3.2 - autoZoomRef.current) * 0.1;
        camera.position.z = 2.0 / autoZoomRef.current;
        // Aim camera at the target's current world position so the hole
        // sits centered on screen
        if (origPos && assembly.current) {
          const worldTarget = new THREE.Vector3();
          if (partMeshes[held.meshName]?.parent) {
            partMeshes[held.meshName].parent!.localToWorld(
              worldTarget.copy(origPos)
            );
          }
          camera.position.x += (worldTarget.x - camera.position.x) * 0.08;
          camera.position.y +=
            (worldTarget.y + 0.3 - camera.position.y) * 0.08;
          camera.lookAt(worldTarget);
        }
      } else {
        autoZoomRef.current = zoom;
        camera.position.z = 2.0 / zoom;
        camera.position.x = cameraOffset.current.x;
        camera.position.y = 1.2 + cameraOffset.current.y;
        // Look at a point that follows the pan offset so panning actually
        // moves the view instead of fighting a fixed origin lookAt.
        camera.lookAt(
          cameraOffset.current.x,
          cameraOffset.current.y,
          0
        );
      }

      const j = joystick.current;

      // Auto-rotate: orient so the highlighted target hole faces the camera.
      // The bolt holes sit near the corners; we rotate the assembly so the
      // chosen corner swings to the front and tilt to expose the hole.
      if (autoRotate && held) {
        const step = stepById[held.stepId];
        const origPos = step ? originalPositions.current[held.meshName] : null;
        if (origPos) {
          // Yaw: bring this corner to the front of the view
          const targetYaw = Math.atan2(origPos.x, origPos.z) + Math.PI;
          let diff = targetYaw - assembly.current.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          assembly.current.rotation.y += diff * 0.1;

          // Flip the table so the hole faces the camera.
          // Tilt back (negative) so we look slightly up at the underside
          // where the bolt threads into.
          const desiredTilt = -0.9;
          assembly.current.rotation.x +=
            (desiredTilt - assembly.current.rotation.x) * 0.1;

          // Shift assembly down a touch so the focused corner sits centered
          assembly.current.position.y +=
            (-0.15 - assembly.current.position.y) * 0.1;
        }
      } else {
        // Ease assembly position back to center when not auto-focusing
        assembly.current.position.y +=
          (0 - assembly.current.position.y) * 0.1;
        if (Math.abs(j.x) > 0.01 || Math.abs(j.y) > 0.01) {
          assembly.current.rotation.y += j.x * 0.06;
          assembly.current.rotation.x = THREE.MathUtils.clamp(
            assembly.current.rotation.x + j.y * 0.04,
            -Math.PI,
            Math.PI
          );
        }
      }

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

      // In screwing state: screw spins on its long axis and drives forward
      if (snapState === 'screwing') {
        const origRot = originalRotations.current[held.meshName];
        if (origRot) {
          // Reset to original orientation each frame
          partMesh.rotation.copy(origRot);
          // Then twist around the WORLD vertical axis (true helical spin).
          // rotateOnWorldAxis keeps the spin vertical regardless of how the
          // part's local axes are oriented in the GLB.
          partMesh.rotateOnWorldAxis(
            new THREE.Vector3(0, 1, 0),
            rotationProgress * Math.PI * 4
          );
        }
        // Drive from just below the surface upward into place
        const driveDist = 0.03 * (1 - rotationProgress);
        partMesh.position.set(origPos.x, origPos.y - driveDist, origPos.z);

        if (rotationProgress > 0.8) {
          tintObj(partMesh, GREEN);
        } else {
          tintObj(partMesh, BLUE);
        }
        hideGhost();
        return;
      }

      // Show ghost at target
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
        // No touch yet — show part at offset start position (no spinning)
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
      ghostRef.current.position.copy(origPos);
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
      // Snap rotation back to exact original (clean finish after screwing spin)
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
      if (assembly.current) {
        assembly.current.rotation.set(0, 0, 0);
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
        <directionalLight position={[0, -3, 0]} intensity={0.4} color="#8899bb" />
        <ambientLight intensity={0.15} />
      </group>
    );
  }
);