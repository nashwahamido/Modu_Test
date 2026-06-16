import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import { GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { LACK_ASSEMBLY, AssemblyStep } from '../../data/lackAssembly';
import { useAssemblyStore } from '../../store/assemblyStore';
import { useAssemblyGestures } from '../../hooks/useAssemblyGestures';
import { AssemblyScene } from './AssemblyScene';
import { Joystick } from './Joystick';
import { PartTray } from './PartTray';
import { FocusModeToggle } from './FocusModeToggle';

// Landscape dimensions
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function AssemblyScreen() {
  const store = useAssemblyStore();
  const focusMode = useAssemblyStore((s) => s.focusMode);
  const def = LACK_ASSEMBLY;

  const pointerNDC = useRef<{ x: number; y: number } | null>(null);
  const joystick = useRef({ x: 0, y: 0 });
  const sceneRef = useRef<any>(null);
  const [ringProgress, setRingProgress] = useState<number | null>(null);

  useEffect(() => {
    store.init(def);
  }, []);

  const toNDC = (x: number, y: number) => ({
    x: (x / SCREEN_W) * 2 - 1,
    y: -(y / SCREEN_H) * 2 + 1,
  });

  const gestures = useAssemblyGestures({
    onPickupProgress: (p, x, y) => setRingProgress(p),
    onPickupComplete: (x, y) => {
      setRingProgress(null);
      const step = store.currentStep();
      if (step && store.canPickUp(step.id)) {
        store.pickUp(step.id, step.meshName);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        pointerNDC.current = toNDC(x, y);
      }
    },
    onPickupCancel: () => setRingProgress(null),
    onHeldMove: (x, y) => {
      pointerNDC.current = toNDC(x, y);
    },
    onRelease: () => {
      if (store.snapState === 'near_correct') {
        const step = store.currentStep();
        store.dropSuccess();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (sceneRef.current?.commitSnap && step) {
          sceneRef.current.commitSnap(step);
        }
      } else {
        store.dropCancel();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }
      pointerNDC.current = null;
    },
  });

  const step = store.currentStep();
  const phase = step?.partNumber === '115980' ? 'Phase 1 — Hanger bolts' : 'Phase 2 — Legs';
  const stepNumber = store.currentStepIndex + 1;
  const totalSteps = def.steps.length;

  return (
    <View style={styles.root}>
      {/* 3D canvas — takes full screen, tray overlays on right */}
      <GestureDetector gesture={gestures.sceneGesture}>
        <View style={StyleSheet.absoluteFill}>
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
              />
            </React.Suspense>
          </Canvas>
        </View>
      </GestureDetector>

      {/* Top step panel — simplified in focus mode */}
      <View style={styles.stepPanel}>
        {!focusMode && (
          <Text style={styles.phase}>{phase}</Text>
        )}
        <Text style={styles.instruction}>
          {store.completed
            ? '🎉 LACK assembled! +' + store.xp + ' XP'
            : step?.instruction}
        </Text>
        {!focusMode && (
          <Text style={styles.sub}>
            {store.completed
              ? 'Great work!'
              : `Step ${stepNumber} of ${totalSteps} · long-press part to pick up`}
          </Text>
        )}
        {focusMode && !store.completed && (
          <Text style={styles.sub}>Long-press to pick up</Text>
        )}
      </View>

      {/* XP counter — dimmed in focus mode */}
      {!focusMode && (
        <Text style={styles.xp}>{store.xp} XP</Text>
      )}

      {/* Focus mode toggle — top right */}
      <View style={styles.focusToggleContainer}>
        <FocusModeToggle />
      </View>

      {/* Part tray — right side */}
      <PartTray
        definition={def}
        onPressPart={(s: AssemblyStep, sx: number, sy: number) => {
          pointerNDC.current = toNDC(sx, sy);
        }}
      />

      {/* Joystick — bottom left */}
      <Joystick vector={joystick} sceneGesture={gestures.sceneGesture} />

      {/* Pickup hint */}
      {ringProgress !== null && (
        <Text style={styles.ringHint}>Hold…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#16162a' },
  stepPanel: {
    position: 'absolute',
    top: 12,
    left: 130, // clear of joystick area
    right: 100, // clear of part tray
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
  xp: {
    position: 'absolute',
    top: 14,
    left: 14,
    color: '#ffb828',
    fontSize: 13,
    fontWeight: '600',
  },
  focusToggleContainer: {
    position: 'absolute',
    bottom: 14,
    right: 100,
  },
  ringHint: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
});