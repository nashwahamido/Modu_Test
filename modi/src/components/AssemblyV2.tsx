import React, { useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import {
  FilamentScene,
  FilamentView,
  ModelRenderer,
  Camera,
  DefaultLight,
  useCameraManipulator,
  useModel,
  useFilamentContext,
  RenderCallback,
} from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LACK_ASSEMBLY, AssemblyStep } from '../data/lackAssembly';
import { useAssemblyStore } from '../store/assemblyStore';
import { JoystickShared } from './JoystickShared';
import { PartTray } from './PartTray';
import { FocusModeToggle } from './FocusModeToggle';
import { AutoRotateToggle } from './AutoRotateToggle';
import { HintsToggle } from './HintsToggle';

/**
 * ASSEMBLY V2 — rebuilt from INDIVIDUAL standalone models.
 *
 * MILESTONE 1: load only the standalone Tabletop.glb and prove it renders
 * correctly (scale, orientation, lighting) with joystick rotate + drag-pan +
 * pinch-zoom. No parts yet — this is the foundation everything else builds on.
 */
function Scene({
  joyX,
  joyY,
  slideX,
  slideZ,
  accumSpin,
  accumTilt,
}: {
  joyX: ReturnType<typeof useSharedValue<number>>;
  joyY: ReturnType<typeof useSharedValue<number>>;
  slideX: ReturnType<typeof useSharedValue<number>>;
  slideZ: ReturnType<typeof useSharedValue<number>>;
  accumSpin: ReturnType<typeof useSharedValue<number>>;
  accumTilt: ReturnType<typeof useSharedValue<number>>;
}) {
  const cameraManipulator = useCameraManipulator({
    orbitHomePosition: [0, 1.5, 5],
    targetPosition: [0, 0, 0],
    orbitSpeed: [0.003, 0.003],
  });

  const viewHeight = Dimensions.get('window').height;
  const viewWidth = Dimensions.get('window').width;

  // Load ONLY the standalone tabletop. The held part is loaded separately by
  // the HeldPart component, which only mounts when a part is held (loading a
  // model via useModel immediately adds it to the scene, so we must not load
  // the parts until they're actually needed).
  const tabletop = useModel({ uri: LACK_ASSEMBLY.tabletopModelUrl });
  const { transformManager, scene } = useFilamentContext();

  // Which part is held (from the store).
  const held = useAssemblyStore((s) => s.held);
  const isBolt = held?.meshName?.startsWith('115980');

  // Held part position (driven by drag) + twist rotation
  const heldX = useSharedValue(0);
  const heldY = useSharedValue(0);
  const heldZ = useSharedValue(0);
  const heldSpin = useSharedValue(0); // twist-to-screw rotation
  const isHolding = useSharedValue(false); // worklet-readable held flag

  // With conditional rendering (only the held part's ModelRenderer mounts),
  // we don't manually add/remove entities — we just track held state.
  const shownName = useRef<string | null>(null);
  useEffect(() => {
    if (!held) {
      shownName.current = null;
      heldX.value = 0;
      heldZ.value = 0;
      isHolding.value = false;
      return;
    }
    shownName.current = held.meshName;
    heldX.value = 0;
    heldZ.value = 0;
    isHolding.value = true;
    // eslint-disable-next-line no-console
    console.log('V2 HELD —', held.meshName, 'isBolt:', isBolt);
  }, [held, isBolt]);


  const renderCallback: RenderCallback = useCallback(() => {
    'worklet';
    if (tabletop.state !== 'loaded') return;
    const root = tabletop.rootEntity;

    accumSpin.value += joyX.value * 0.04;
    accumTilt.value -= joyY.value * 0.04;
    const lim = Math.PI / 2;
    if (accumTilt.value > lim) accumTilt.value = lim;
    if (accumTilt.value < -lim) accumTilt.value = -lim;

    const he = tabletop.boundingBox.halfExtent;
    const maxHalf = Math.max(he[0], he[1], he[2]) || 1;
    const s = 0.5 / maxHalf;

    let m = transformManager.createIdentityMatrix();
    m = m.scaling([s, s, s]);
    m = m.rotate(accumTilt.value, [1, 0, 0]);
    m = m.rotate(accumSpin.value, [0, 1, 0]);
    m = m.translate([slideX.value, 0, slideZ.value]);
    transformManager.setTransform(root, m);
  }, [
    tabletop,
    transformManager,
    joyX,
    joyY,
    slideX,
    slideZ,
    accumSpin,
    accumTilt,
  ]);

  // Drag → move held part if holding, else pan the tabletop
  const dragStartX = useSharedValue(0);
  const dragStartZ = useSharedValue(0);
  const partStartX = useSharedValue(0);
  const partStartZ = useSharedValue(0);
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      'worklet';
      dragStartX.value = slideX.value;
      dragStartZ.value = slideZ.value;
      partStartX.value = heldX.value;
      partStartZ.value = heldZ.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (isHolding.value) {
        // Move the held PART (independent model)
        heldX.value = partStartX.value + e.translationX * 0.006;
        heldZ.value = partStartZ.value + e.translationY * 0.006;
      } else {
        // Pan the tabletop
        slideX.value = dragStartX.value + e.translationX * 0.01;
        slideZ.value = dragStartZ.value + e.translationY * 0.01;
      }
    });

  const lastScale = useRef(1);
  const pinchGesture = Gesture.Pinch()
    .onBegin((e) => {
      lastScale.current = e.scale || 1;
    })
    .onUpdate((e) => {
      const scale = e.scale || 1;
      const ratio = scale / lastScale.current;
      lastScale.current = scale;
      const step = (ratio - 1) * 400;
      cameraManipulator?.scroll(viewWidth / 2, viewHeight / 2, -step);
    });

  const combinedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  return (
    <GestureDetector gesture={combinedGesture}>
      <FilamentView style={styles.fill} renderCallback={renderCallback}>
        <Camera cameraManipulator={cameraManipulator} />
        <DefaultLight />
        <ModelRenderer model={tabletop} />
        {held != null && (
          <HeldPart
            uri={isBolt ? LACK_ASSEMBLY.boltModelUrl : LACK_ASSEMBLY.legModelUrl}
            heldX={heldX}
            heldY={heldY}
            heldZ={heldZ}
            heldSpin={heldSpin}
          />
        )}
      </FilamentView>
    </GestureDetector>
  );
}

/**
 * HeldPart — loads ONE standalone part model and positions it from shared
 * values. Only mounts while a part is held (loading a model via useModel adds
 * it to the scene, so mounting/unmounting is how we show/hide the part).
 * Independent of the tabletop → joystick rotation does NOT affect it.
 */
function HeldPart({
  uri,
  heldX,
  heldY,
  heldZ,
  heldSpin,
}: {
  uri: string;
  heldX: ReturnType<typeof useSharedValue<number>>;
  heldY: ReturnType<typeof useSharedValue<number>>;
  heldZ: ReturnType<typeof useSharedValue<number>>;
  heldSpin: ReturnType<typeof useSharedValue<number>>;
}) {
  const model = useModel({ uri });
  const { transformManager } = useFilamentContext();

  // Position the part each frame from the shared values (JS rAF loop — simple
  // and safe; transformManager calls from JS are fine).
  useEffect(() => {
    let raf: number;
    const tick = () => {
      if (model.state === 'loaded') {
        try {
          const he = model.boundingBox.halfExtent;
          const hmax = Math.max(he[0], he[1], he[2]) || 1;
          const hs = 0.25 / hmax;
          let pm = transformManager.createIdentityMatrix();
          pm = pm.scaling([hs, hs, hs]);
          pm = pm.rotate(heldSpin.value, [0, 1, 0]);
          pm = pm.translate([heldX.value, 0.4 + heldY.value, heldZ.value]);
          transformManager.setTransform(model.rootEntity, pm);
        } catch {}
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [model, transformManager, heldX, heldY, heldZ, heldSpin]);

  return <ModelRenderer model={model} />;
}

export function AssemblyV2() {
  const store = useAssemblyStore();
  const focusMode = useAssemblyStore((s) => s.focusMode);
  const held = useAssemblyStore((s) => s.held);
  const snapState = useAssemblyStore((s) => s.snapState);
  const rotationProgress = useAssemblyStore((s) => s.rotationProgress);
  const statuses = useAssemblyStore((s) => s.statuses);
  const def = LACK_ASSEMBLY;

  const joyX = useSharedValue(0);
  const joyY = useSharedValue(0);
  const slideX = useSharedValue(0);
  const slideZ = useSharedValue(0);
  const accumSpin = useSharedValue(0);
  const accumTilt = useSharedValue(0);

  useEffect(() => {
    store.init(def);
  }, []);

  const handlePickup = useCallback((step: AssemblyStep) => {
    // Mechanics come in Milestone 2; for now record the held part.
    store.pickUp(step.id, step.meshName);
  }, []);

  const handleReset = useCallback(() => {
    store.reset();
    store.init(def);
    slideX.value = 0;
    slideZ.value = 0;
    accumSpin.value = 0;
    accumTilt.value = 0;
  }, []);

  const step = store.currentStep();
  const phase =
    step?.partNumber === '115980' ? 'Phase 1 — Hanger bolts' : 'Phase 2 — Legs';
  const stepNumber = store.currentStepIndex + 1;
  const totalSteps = def.steps.length;
  const isScrewing = snapState === 'screwing';
  const doneCount = Object.values(statuses).filter((v) => v === 'done').length;
  const overallPct = Math.round((doneCount / totalSteps) * 100);

  return (
    <View style={styles.root}>
      <FilamentScene>
        <Scene
          joyX={joyX}
          joyY={joyY}
          slideX={slideX}
          slideZ={slideZ}
          accumSpin={accumSpin}
          accumTilt={accumTilt}
        />
      </FilamentScene>

      {/* Step panel */}
      <View style={styles.stepPanel} pointerEvents="none">
        {!focusMode && <Text style={styles.phase}>{phase}</Text>}
        <Text style={styles.instruction}>
          {store.completed
            ? 'LACK assembled! +' + store.xp + ' XP'
            : step?.instruction}
        </Text>
        {!focusMode && !held && (
          <Text style={styles.sub}>
            {store.completed
              ? 'Great work!'
              : `Step ${stepNumber} of ${totalSteps} · Tap a part to start`}
          </Text>
        )}
        {store.guidanceOn && held && !isScrewing && (
          <Text style={styles.heldHint}>Drag to the green dot, then twist</Text>
        )}
        {store.guidanceOn && isScrewing && (
          <Text style={styles.screwHint}>Twist in a circle to screw in</Text>
        )}
      </View>

      {!focusMode && (
        <View style={styles.overallProgress} pointerEvents="none">
          <View style={styles.overallTrack}>
            <View style={[styles.overallFill, { width: `${overallPct}%` }]} />
          </View>
          <Text style={styles.overallLabel}>
            {doneCount} / {totalSteps} parts · {overallPct}%
          </Text>
        </View>
      )}

      {!focusMode && <Text style={styles.xp}>{store.xp} XP</Text>}

      <Pressable style={styles.resetBtn} onPress={handleReset}>
        <Text style={styles.resetText}>Reset</Text>
      </Pressable>

      {held && (
        <Pressable style={styles.cancelBtn} onPress={() => store.dropCancel()}>
          <Text style={styles.cancelText}>← Back to tray</Text>
        </Pressable>
      )}

      <View style={styles.toggleContainer}>
        <HintsToggle />
        <AutoRotateToggle />
        <FocusModeToggle />
      </View>

      <PartTray definition={def} onPickupPart={handlePickup} />

      <JoystickShared outX={joyX} outY={joyY} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#6f8a68' },
  fill: { ...StyleSheet.absoluteFill },
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
    zIndex: 1000,
    elevation: 1000,
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
  heldHint: { color: '#3ddc84', fontSize: 10, marginTop: 4, fontWeight: '600' },
  screwHint: { color: '#ffb828', fontSize: 11, marginTop: 4, fontWeight: '700' },
  xp: {
    position: 'absolute',
    top: 14,
    left: 14,
    color: '#ffb828',
    fontSize: 13,
    fontWeight: '600',
    zIndex: 1000,
    elevation: 1000,
  },
  overallProgress: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  overallTrack: {
    width: 240,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  overallFill: { height: '100%', backgroundColor: '#ffb828', borderRadius: 4 },
  overallLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  resetBtn: {
    position: 'absolute',
    top: 14,
    left: 60,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  resetText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  cancelBtn: {
    position: 'absolute',
    top: 52,
    left: 60,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,80,80,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,120,120,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  cancelText: { color: '#ffd0d0', fontSize: 12, fontWeight: '600' },
  toggleContainer: {
    position: 'absolute',
    bottom: 14,
    right: 100,
    flexDirection: 'row',
    gap: 8,
    zIndex: 1000,
    elevation: 1000,
  },
});