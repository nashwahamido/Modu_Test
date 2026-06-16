import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei/native';
import { useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { AssemblyDefinition, AssemblyStep } from '../../data/lackAssembly';
import { useAssemblyStore } from '../../store/assemblyStore';
import { Tool } from './Tool';

interface SceneProps {
  definition: AssemblyDefinition;
  pointerNDC: React.MutableRefObject<{ x: number; y: number } | null>;
  joystick: React.MutableRefObject<{ x: number; y: number }>;
}

const GREEN = new THREE.Color('#3ddc84');
const BLUE = new THREE.Color('#4a90ff');
const FLASH = new THREE.Color('#ff8a14');

function tint(mesh: THREE.Mesh, color: THREE.Color): void {
  const m = mesh.material as THREE.MeshStandardMaterial;
  if (m && m.emissive) {
    m.emissive.copy(color);
    m.emissiveIntensity = 0.6;
  }
}

function clearTint(mesh: THREE.Mesh): void {
  const m = mesh.material as THREE.MeshStandardMaterial;
  if (m && m.emissive) {
    m.emissive.setHex(0x000000);
    m.emissiveIntensity = 0;
  }
}

export const AssemblyScene = React.forwardRef<unknown, SceneProps>(
  function AssemblySceneInner({ definition, pointerNDC, joystick }, ref) {
    const { scene: gltf } = useGLTF(definition.glbUrl);
    const { camera } = useThree();
    const assembly = useRef<THREE.Group>(null);

    const held = useAssemblyStore((s) => s.held);
    const setSnapState = useAssemblyStore((s) => s.setSnapState);
    const guidanceOn = useAssemblyStore((s) => s.guidanceOn);

    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const ghostRef = useRef<THREE.Mesh | null>(null);
    const [toolActive, setToolActive] = useState(false);
    const [toolStep, setToolStep] = useState<AssemblyStep | null>(null);

    // Build lookup of every part mesh by node name
    const partMeshes = useMemo(() => {
      const map: Record<string, THREE.Object3D> = {};
      gltf.traverse((o: THREE.Object3D) => {
        if (o.name) map[o.name] = o;
      });
      return map;
    }, [gltf]);

    // DISMANTLE on mount: hide step parts, show base parts only
    useEffect(() => {
      definition.steps.forEach((step: AssemblyStep) => {
        const m = partMeshes[step.meshName];
        if (m) m.visible = false;
      });
      definition.baseMeshNames.forEach((name: string) => {
        const m = partMeshes[name];
        if (m) m.visible = true;
      });
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

      // Joystick rotates the whole assembly
      const j = joystick.current;
      if (Math.abs(j.x) > 0.01 || Math.abs(j.y) > 0.01) {
        assembly.current.rotation.y += j.x * 0.06;
        assembly.current.rotation.x = THREE.MathUtils.clamp(
          assembly.current.rotation.x + j.y * 0.04,
          -0.6,
          0.6
        );
      }

      if (!held) return;
      const step = stepById[held.stepId];
      const partMesh = partMeshes[held.meshName] as THREE.Mesh | undefined;
      if (!step || !partMesh) return;

      partMesh.visible = true;

      const ndc = pointerNDC.current;
      if (ndc) {
        raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        const planeY = step.target[1] + 0.5;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
        const hit = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, hit);
        if (hit) {
          const local = assembly.current.worldToLocal(hit.clone());
          partMesh.position.set(local.x, step.target[1] + 0.5, local.z);
          partMesh.rotation.y += 0.05;

          const target = new THREE.Vector3(
            step.target[0],
            step.target[1],
            step.target[2]
          );
          const planar = Math.hypot(local.x - target.x, local.z - target.z);

          if (planar < step.snapRadius) {
            setSnapState('near_correct');
            tint(partMesh, GREEN);
            showGhost(step, partMesh, assembly.current);
          } else if (planar < step.snapRadius * 3) {
            setSnapState('near_rotation');
            tint(partMesh, BLUE);
            hideGhost();
          } else {
            setSnapState('held');
            clearTint(partMesh);
            hideGhost();
          }
        }
      }
    });

    function showGhost(
      step: AssemblyStep,
      src: THREE.Mesh,
      parent: THREE.Group
    ): void {
      if (!guidanceOn) return;
      if (!ghostRef.current) {
        const ghost = src.clone() as THREE.Mesh;
        ghost.material = new THREE.MeshStandardMaterial({
          color: GREEN,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        });
        ghost.name = '__ghost';
        parent.add(ghost);
        ghostRef.current = ghost;
      }
      ghostRef.current.position.set(
        step.target[0],
        step.target[1],
        step.target[2]
      );
      ghostRef.current.rotation.set(
        step.targetRotation[0],
        step.targetRotation[1],
        step.targetRotation[2]
      );
      ghostRef.current.visible = true;
    }

    function hideGhost(): void {
      if (ghostRef.current) ghostRef.current.visible = false;
    }

    function commitSnap(step: AssemblyStep): void {
      const partMesh = partMeshes[step.meshName] as THREE.Mesh | undefined;
      if (!partMesh) return;
      partMesh.position.set(
        step.target[0],
        step.target[1],
        step.target[2]
      );
      partMesh.rotation.set(
        step.targetRotation[0],
        step.targetRotation[1],
        step.targetRotation[2]
      );
      clearTint(partMesh);
      hideGhost();
      flashAssembly();
      setToolStep(step);
      setToolActive(true);
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

    // Expose commitSnap to parent via ref
    React.useImperativeHandle(ref, () => ({
      commitSnap,
    }));

    return (
      <group ref={assembly}>
        <primitive object={gltf} />
        {toolStep && (
          <Tool
            kind={toolStep.tool}
            position={[
              toolStep.target[0],
              toolStep.target[1] + 0.2,
              toolStep.target[2],
            ]}
            active={toolActive}
            onDone={() => setToolActive(false)}
          />
        )}
      </group>
    );
  }
);