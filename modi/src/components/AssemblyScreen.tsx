import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';

import { LACK_ASSEMBLY, AssemblyStep } from '../data/lackAssembly';
import { useAssemblyStore } from '../store/assemblyStore';
import { AssemblyScene } from './AssemblyScene';
import { Joystick } from './Joystick';
import { PartTray } from './PartTray';
import { FocusModeToggle } from './FocusModeToggle';
import { AutoRotateToggle } from './AutoRotateToggle';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function getDistance(touches: any[]): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}

export function AssemblyScreen() {
  const store = useAssemblyStore();
  const focusMode = useAssemblyStore((s) => s.focusMode);
  const held = useAssemblyStore((s) => s.held);
  const snapState = useAssemblyStore((s) => s.snapState);
  const rotationProgress = useAssemblyStore((s) => s.rotationProgress);
  const def = LACK_ASSEMBLY;

  const pointerNDC = useRef<{ x: number; y: number } | null>(null);
  const joystick = useRef({ x: 0, y: 0 });
  const sceneRef = useRef<any>(null);
  const [heldLabel, setHeldLabel] = useState<string | null>(null);

  const cameraOffset = useRef({ x: 0, y: 0 });
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDist = useRef<number>(0);
  const baseZoom = useRef<number>(1);

  // For rotation gesture
  const lastAngle = useRef<number | null>(null);
  const rotationCenter = useRef({ x: SCREEN_W / 2, y: SCREEN_H / 2 });

  useEffect(() => {
    store.init(def);
  }, []);

  const handleTouchStart = useCallback((e: any) => {
    const touches = e.nativeEvent.touches;
    const s = useAssemblyStore.getState();

    if (touches.length === 2 && s.snapState !== 'screwing') {
      lastPinchDist.current = getDistance(touches);
      baseZoom.current = s.zoom;
    } else if (touches.length === 1) {
      if (s.snapState === 'screwing') {
        // Start tracking rotation angle
        const dx = touches[0].pageX - rotationCenter.current.x;
        const dy = touches[0].pageY - rotationCenter.current.y;
        lastAngle.current = Math.atan2(dy, dx);
      } else if (s.held) {
        pointerNDC.current = {
          x: (touches[0].pageX / SCREEN_W) * 2 - 1,
          y: -(touches[0].pageY / SCREEN_H) * 2 + 1,
        };
      } else {
        lastPanPos.current = { x: touches[0].pageX, y: touches[0].pageY };
      }
    }
  }, []);

  const handleTouchMove = useCallback((e: any) => {
    const touches = e.nativeEvent.touches;
    const s = useAssemblyStore.getState();

    if (touches.length === 2 && s.snapState !== 'screwing') {
      const dist = getDistance(touches);
      if (lastPinchDist.current > 0) {
        const scale = dist / lastPinchDist.current;
        s.setZoom(baseZoom.current * scale);
      }
      return;
    }

    if (touches.length === 1) {
      if (s.snapState === 'screwing') {
        // Detect circular rotation
        const dx = touches[0].pageX - rotationCenter.current.x;
        const dy = touches[0].pageY - rotationCenter.current.y;
        const angle = Math.atan2(dy, dx);

        if (lastAngle.current !== null) {
          let delta = angle - lastAngle.current;
          // Normalize to -PI..PI
          if (delta > Math.PI) delta -= Math.PI * 2;
          if (delta < -Math.PI) delta += Math.PI * 2;
          // Only count counterclockwise (negative delta on screen = CCW)
          // Accept both directions for usability
          const absDelta = Math.abs(delta);
          if (absDelta > 0.01) {
            // Each full rotation (2π) ≈ 66% → ~1.5 rotations to complete
            s.addRotation(absDelta / (Math.PI * 3));
            Haptics.selectionAsync();
          }
        }
        lastAngle.current = angle;

        // Check if done
        if (useAssemblyStore.getState().rotationProgress >= 1) {
          const step = s.currentStep();
          if (step && sceneRef.current?.commitSnap) {
            sceneRef.current.commitSnap(step);
          }
          s.dropSuccess();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setHeldLabel(null);
          pointerNDC.current = null;
          lastAngle.current = null;
        }
        return;
      }

      if (s.held) {
        pointerNDC.current = {
          x: (touches[0].pageX / SCREEN_W) * 2 - 1,
          y: -(touches[0].pageY / SCREEN_H) * 2 + 1,
        };
      } else {
        if (lastPanPos.current) {
          const dx2 = (touches[0].pageX - lastPanPos.current.x) * 0.003;
          const dy2 = (touches[0].pageY - lastPanPos.current.y) * 0.003;
          cameraOffset.current = {
            x: cameraOffset.current.x - dx2,
            y: cameraOffset.current.y + dy2,
          };
          lastPanPos.current = { x: touches[0].pageX, y: touches[0].pageY };
        }
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPanPos.current = null;
    lastPinchDist.current = 0;
    lastAngle.current = null;

    const s = useAssemblyStore.getState();
    if (!s.held || s.snapState === 'screwing') return;

    if (s.snapState === 'near_correct') {
      // Snap to position, then enter screwing phase
      s.startScrewing();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Place part at target in scene
      pointerNDC.current = null;
    }
  }, []);

  const handlePickupFromTray = useCallback((step: AssemblyStep) => {
    const s = useAssemblyStore.getState();
    if (s.canPickUp(step.id)) {
      s.pickUp(step.id, step.meshName);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setHeldLabel(step.label);
    }
  }, []);

  const handleCancel = useCallback(() => {
    const s = useAssemblyStore.getState();
    if (s.held && sceneRef.current?.hidePartMesh) {
      sceneRef.current.hidePartMesh(s.held.meshName);
    }
    s.dropCancel();
    pointerNDC.current = null;
    setHeldLabel(null);
    lastAngle.current = null;
  }, []);

  const handleReset = useCallback(() => {
    cameraOffset.current = { x: 0, y: 0 };
    useAssemblyStore.getState().setZoom(1);
    if (sceneRef.current?.resetView) {
      sceneRef.current.resetView();
    }
  }, []);

  const step = store.currentStep();
  const phase =
    step?.partNumber === '115980'
      ? 'Phase 1 — Hanger bolts'
      : 'Phase 2 — Legs';
  const stepNumber = store.currentStepIndex + 1;
  const totalSteps = def.steps.length;
  const isScrewing = snapState === 'screwing';
  const progressPct = Math.round(rotationProgress * 100);

  return (
    <View style={styles.root}>
      <View
        style={StyleSheet.absoluteFill}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Canvas camera={{ position: [0, 1.2, 2.0], fov: 42 }}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 6, 4]} intensity={0.85} castShadow />
          <directionalLight position={[-3, 2, -2]} intensity={0.25} color="#6688ff" />
          <React.Suspense fallback={null}>
            <AssemblyScene
              ref={sceneRef}
              definition={def}
              pointerNDC={pointerNDC}
              joystick={joystick}
              cameraOffset={cameraOffset}
            />
          </React.Suspense>
        </Canvas>
      </View>

      {/* Step panel */}
      <View style={styles.stepPanel} pointerEvents="none">
        {!focusMode && <Text style={styles.phase}>{phase}</Text>}
        <Text style={styles.instruction}>
          {store.completed
            ? '🎉 LACK assembled! +' + store.xp + ' XP'
            : step?.instruction}
        </Text>
        {!focusMode && !held && (
          <Text style={styles.sub}>
            {store.completed
              ? 'Great work!'
              : `Step ${stepNumber} of ${totalSteps} · Tap a part to start`}
          </Text>
        )}
        {held && !isScrewing && (
          <Text style={styles.heldHint}>Drag to the green dot, then lift</Text>
        )}
        {isScrewing && (
          <Text style={styles.screwHint}>
            🔄 Rotate your finger in circles to screw in!
          </Text>
        )}
      </View>

      {/* XP */}
      {!focusMode && <Text style={styles.xp}>{store.xp} XP</Text>}

      {/* Rotation progress indicator */}
      {isScrewing && (
        <View style={styles.rotationOverlay} pointerEvents="none">
          <View style={styles.rotationRing}>
            <View
              style={[
                styles.rotationFill,
                {
                  width: `${progressPct}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.rotationText}>
            {progressPct < 100 ? `${progressPct}%` : '✓ Done!'}
          </Text>
          <Text style={styles.rotationArrow}>↻</Text>
        </View>
      )}

      {/* Cancel button */}
      {held && (
        <Pressable style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelText}>✕ Cancel</Text>
        </Pressable>
      )}

      {/* Reset */}
      <Pressable style={styles.resetBtn} onPress={handleReset}>
        <Text style={styles.resetText}>⟳</Text>
      </Pressable>

      {/* Focus toggle + Auto-view toggle */}
      <View style={styles.focusToggleContainer}>
        <AutoRotateToggle />
        <FocusModeToggle />
      </View>

      {/* Part tray */}
      <PartTray definition={def} onPickupPart={handlePickupFromTray} />

      {/* Joystick */}
      <Joystick vector={joystick} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16162a' },
  stepPanel: {
    position: 'absolute',
    top: 12,
    left: 130,
    right: 100,
    backgroundColor: 'rgba(20,20,40,0.85)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  phase: {
    color: '#64b4ff',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  instruction: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  heldHint: {
    color: '#3ddc84',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  screwHint: {
    color: '#ffb828',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
  },
  xp: {
    position: 'absolute',
    top: 14,
    left: 14,
    color: '#ffb828',
    fontSize: 13,
    fontWeight: '600',
  },
  rotationOverlay: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    alignItems: 'center',
  },
  rotationRing: {
    width: 130,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  rotationFill: {
    height: '100%',
    backgroundColor: '#3ddc84',
    borderRadius: 6,
  },
  rotationText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  rotationArrow: {
    color: '#ffb828',
    fontSize: 36,
    marginTop: 4,
  },
  cancelBtn: {
    position: 'absolute',
    bottom: 14,
    left: 140,
    backgroundColor: 'rgba(255,60,60,0.25)',
    borderColor: 'rgba(255,60,60,0.6)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cancelText: {
    color: '#ff6060',
    fontSize: 12,
    fontWeight: '600',
  },
  resetBtn: {
    position: 'absolute',
    top: 14,
    left: 60,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
  },
  focusToggleContainer: {
    position: 'absolute',
    bottom: 14,
    right: 100,
    flexDirection: 'row',
    gap: 8,
  },
});