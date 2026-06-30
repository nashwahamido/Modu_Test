import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Animated,
} from 'react-native';
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
import * as Haptics from 'expo-haptics';
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
  heldX,
  heldY,
  heldZ,
  heldSpin,
  isHolding,
}: {
  joyX: ReturnType<typeof useSharedValue<number>>;
  joyY: ReturnType<typeof useSharedValue<number>>;
  slideX: ReturnType<typeof useSharedValue<number>>;
  slideZ: ReturnType<typeof useSharedValue<number>>;
  accumSpin: ReturnType<typeof useSharedValue<number>>;
  accumTilt: ReturnType<typeof useSharedValue<number>>;
  // Held-part transform — lifted to AssemblyV2 so the PartTray's drag gesture
  // can drive the part's position directly while it's being dragged in.
  heldX: ReturnType<typeof useSharedValue<number>>;
  heldY: ReturnType<typeof useSharedValue<number>>;
  heldZ: ReturnType<typeof useSharedValue<number>>;
  heldSpin: ReturnType<typeof useSharedValue<number>>;
  isHolding: ReturnType<typeof useSharedValue<boolean>>;
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
  const tabletop = useModel(LACK_ASSEMBLY.tabletopModel);
  const { transformManager, scene } = useFilamentContext();

  // Which part is held (from the store).
  const held = useAssemblyStore((s) => s.held);
  const isBolt = held?.meshName?.startsWith('115980');

  // The loaded held-part model, lifted up from HeldPartLoader so the render
  // worklet (below) can transform it on the render thread — JS-thread
  // setTransform does not take effect, which is why the old rAF approach
  // loaded the part but never showed it.
  const [heldModel, setHeldModel] = useState<ReturnType<typeof useModel> | null>(
    null
  );

  // Held part transform values now come in as props (created in AssemblyV2),
  // so the PartTray drag gesture and this Scene share the same values.

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
    // NOTE: do NOT reset heldX/heldZ here. Placement is set by whoever picked
    // the part up — the tray's tap handler centres it (0,0); the tray's drag
    // gesture writes the finger position. Zeroing here would fight the drag.
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
    const tc = tabletop.boundingBox.center;
    const maxHalf = Math.max(he[0], he[1], he[2]) || 1;
    const s = 0.5 / maxHalf;

    let m = transformManager.createIdentityMatrix();
    // Recenter on the tabletop's own bbox center FIRST (innermost factor) so it
    // rotates around its middle, not around the GLB origin (which sits off to
    // one side because the model was exported in place).
    m = m.translate([-tc[0], -tc[1], -tc[2]]);
    m = m.scaling([s, s, s]);
    m = m.rotate(accumTilt.value, [1, 0, 0]);
    m = m.rotate(accumSpin.value, [0, 1, 0]);
    m = m.translate([slideX.value, 0, slideZ.value]);
    transformManager.setTransform(root, m);

    // Held part — transformed in the SAME render worklet as the tabletop, so
    // setTransform runs on the render thread (where it actually takes effect).
    // Its own matrix, so the tabletop's rotation/pan does not affect it.
    if (heldModel != null && heldModel.state === 'loaded') {
      const hC = heldModel.boundingBox.center;
      // Scale the held part by the SAME factor as the tabletop (s), so its
      // real-world size is preserved relative to the table — a ~7cm bolt next
      // to a ~55cm top — instead of normalising it to its own size (huge).
      const hs = s;
      let pm = transformManager.createIdentityMatrix();
      // Recenter on the part's own bbox center first (innermost factor) so an
      // in-place export isn't flung off-screen by the scale.
      pm = pm.translate([-hC[0], -hC[1], -hC[2]]);
      pm = pm.scaling([hs, hs, hs]);
      pm = pm.rotate(heldSpin.value, [0, 1, 0]);
      pm = pm.translate([heldX.value, 0.12 + heldY.value, heldZ.value]);
      transformManager.setTransform(heldModel.rootEntity, pm);
    }
  }, [
    tabletop,
    transformManager,
    joyX,
    joyY,
    slideX,
    slideZ,
    accumSpin,
    accumTilt,
    heldModel,
    heldX,
    heldY,
    heldZ,
    heldSpin,
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

  const tableScale =
    tabletop.state === 'loaded'
      ? 0.5 / (Math.max(...tabletop.boundingBox.halfExtent) || 1)
      : 1;

  return (
    <>
      <GestureDetector gesture={combinedGesture}>
        <FilamentView style={styles.fill} renderCallback={renderCallback}>
          <Camera cameraManipulator={cameraManipulator} />
          <DefaultLight />
          <ModelRenderer model={tabletop} />
          {held != null && (
            <HeldPartLoader
              source={isBolt ? LACK_ASSEMBLY.boltModel : LACK_ASSEMBLY.legModel}
              onModel={setHeldModel}
            />
          )}
        </FilamentView>
      </GestureDetector>
      {tabletop.state === 'loaded' && (
        <TargetDots
          bbox={tabletop.boundingBox}
          scaleS={tableScale}
          accumSpin={accumSpin}
          accumTilt={accumTilt}
          slideX={slideX}
          slideZ={slideZ}
          heldX={heldX}
          heldZ={heldZ}
          held={held}
        />
      )}
    </>
  );
}

/**
 * TargetDots — pulsing green circles drawn ON the tabletop's bolt holes.
 *
 * The holes live in the table's 3D space, so each frame we take the hole's
 * local offset, run it through the SAME transform the render worklet applies
 * (scale → tilt → spin → slide), then project it to screen coordinates with
 * RNF's view.projectWorldToScreen and place a 2D dot there. The dots therefore
 * track the table as it rotates / pans / zooms.
 *
 * Tuning knobs (top of the component): HOLE_INSET (how far in from the corners),
 * SURFACE_SIGN (which face the holes sit on), and PROJECT_SCALE (physical →
 * logical pixel correction for projectWorldToScreen).
 */
const RING = 30; // small ring sized to the hole, not a big glow
const HOLE_INSET = 0.78; // fraction of the half-extent (1 = exact corner)
const SURFACE_SIGN = 1; // +1 top face, -1 bottom face
const PROJECT_SCALE = 1; // projectWorldToScreen returns logical px; tune if off
const ATTRACT_RADIUS = 0.2; // world units: the hole starts easing the bolt in
const SNAP_RADIUS = 0.085; // world units: bolt locks into the hole + attaches

/**
 * TargetDots — ONE pulsing green spotlight on the hole for the current step,
 * plus the magnetic snap that makes the bolt easy to place.
 *
 * Each frame we take the active hole's local offset, run it through the SAME
 * transform the render worklet applies (scale → tilt → spin → slide) to get its
 * world position, then:
 *   1. compare it to the held bolt's world position (heldX/heldZ); within
 *      ATTRACT_RADIUS we ease the bolt toward the hole, within SNAP_RADIUS we
 *      lock it on and attach (advance the step);
 *   2. project the world position to screen and draw the pulsing spotlight.
 */
function TargetDots({
  bbox,
  scaleS,
  accumSpin,
  accumTilt,
  slideX,
  slideZ,
  heldX,
  heldZ,
  held,
}: {
  bbox: { halfExtent: number[]; center: number[] };
  scaleS: number;
  accumSpin: ReturnType<typeof useSharedValue<number>>;
  accumTilt: ReturnType<typeof useSharedValue<number>>;
  slideX: ReturnType<typeof useSharedValue<number>>;
  slideZ: ReturnType<typeof useSharedValue<number>>;
  heldX: ReturnType<typeof useSharedValue<number>>;
  heldZ: ReturnType<typeof useSharedValue<number>>;
  held: { stepId: string } | null;
}) {
  const { view } = useFilamentContext();
  const currentStepIndex = useAssemblyStore((s) => s.currentStepIndex);
  const completed = useAssemblyStore((s) => s.completed);
  const dropSuccess = useAssemblyStore((s) => s.dropSuccess);
  // Position is driven imperatively via Animated.setValue (NO per-frame
  // setState — that was re-rendering 60×/sec and making the drag stutter).
  const posX = useRef(new Animated.Value(0)).current;
  const posY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const attachedRef = useRef(false);
  const loggedOnce = useRef(false);

  // Reset the one-shot attach guard each time a new part is picked up.
  useEffect(() => {
    attachedRef.current = false;
  }, [held?.stepId]);

  // Continuous pulse (native driver — independent of the JS position updates).
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const he = bbox.halfExtent;
      const hx = he[0] * HOLE_INSET;
      const hz = he[2] * HOLE_INSET;
      const surfaceY = he[1] * SURFACE_SIGN;
      // The active hole only (corner = step index, wrapping 0–3).
      const corners: [number, number, number][] = [
        [hx, surfaceY, hz],
        [hx, surfaceY, -hz],
        [-hx, surfaceY, hz],
        [-hx, surfaceY, -hz],
      ];
      const off = corners[currentStepIndex % 4];

      // World position = scale → rotateX(tilt) → rotateY(spin) → translate(pan),
      // matching the render worklet's tabletop transform.
      const ct = Math.cos(accumTilt.value);
      const st = Math.sin(accumTilt.value);
      const cs = Math.cos(accumSpin.value);
      const ss = Math.sin(accumSpin.value);
      let x = off[0] * scaleS;
      let y = off[1] * scaleS;
      let z = off[2] * scaleS;
      const y1 = y * ct - z * st;
      const z1 = y * st + z * ct;
      y = y1;
      z = z1;
      const x2 = x * cs + z * ss;
      const z2 = -x * ss + z * cs;
      x = x2;
      z = z2;
      x += slideX.value;
      z += slideZ.value;

      // Magnetic snap: ease the held bolt toward the hole once it's close, then
      // lock + attach. Tighter radii so it takes real aim.
      if (held && !attachedRef.current) {
        const dx = x - heldX.value;
        const dz = z - heldZ.value;
        const dist = Math.hypot(dx, dz);
        if (dist < ATTRACT_RADIUS) {
          heldX.value += dx * 0.3;
          heldZ.value += dz * 0.3;
        }
        if (dist < SNAP_RADIUS) {
          heldX.value = x;
          heldZ.value = z;
          attachedRef.current = true;
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {}
          dropSuccess();
        }
      }

      try {
        const screen = view.projectWorldToScreen([x, y, z]);
        posX.setValue(screen[0] * PROJECT_SCALE - RING / 2);
        posY.setValue(screen[1] * PROJECT_SCALE - RING / 2);
        if (!visibleRef.current) {
          visibleRef.current = true;
          setVisible(true);
        }
        if (!loggedOnce.current) {
          loggedOnce.current = true;
          // eslint-disable-next-line no-console
          console.log(
            'V2 TargetDots — bbox.halfExtent:',
            JSON.stringify(he),
            '| active hole screen:',
            JSON.stringify([screen[0], screen[1]])
          );
        }
      } catch {}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    bbox,
    view,
    scaleS,
    accumSpin,
    accumTilt,
    slideX,
    slideZ,
    heldX,
    heldZ,
    held,
    currentStepIndex,
    dropSuccess,
    posX,
    posY,
  ]);

  if (completed || !visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* JS-driven position wrapper; inner ring does the native-driver pulse. */}
      <Animated.View
        style={{
          position: 'absolute',
          transform: [{ translateX: posX }, { translateY: posY }],
        }}
      >
        <Animated.View
          style={[
            styles.spotRing,
            {
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1.25],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

/**
 * HeldPartLoader — loads ONE standalone part model and lifts the loaded model
 * up to <Scene> (via onModel) so the render worklet can transform it on the
 * render thread, where setTransform actually takes effect. Only mounts while a
 * part is held; rendering <ModelRenderer> is what adds it to the scene.
 */
function HeldPartLoader({
  source,
  onModel,
}: {
  source: number;
  onModel: (m: ReturnType<typeof useModel> | null) => void;
}) {
  const model = useModel(source);

  // Lift the loaded model up to <Scene> — but only when the LOAD STATE
  // changes, not on every render. useModel returns a new wrapper object each
  // render (its rootEntity/boundingBox are memoised on the asset, so they stay
  // stable); depending on the whole object here caused an infinite setState
  // loop. onModel (setHeldModel) is identity-stable, so it's safe to omit.
  useEffect(() => {
    onModel(model.state === 'loaded' ? model : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.state]);

  // Clear it on unmount (part dropped / cancelled).
  useEffect(() => () => onModel(null), [onModel]);

  useEffect(() => {
    if (model.state === 'loaded') {
      // eslint-disable-next-line no-console
      console.log(
        'V2 HeldPart — LOADED. halfExtent:',
        JSON.stringify(model.boundingBox.halfExtent),
        '| center:',
        JSON.stringify(model.boundingBox.center)
      );
    }
  }, [model.state]);

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

  // Held-part transform — shared with the Scene (which renders the part) and
  // the PartTray (whose drag gesture moves it while being dragged in).
  const heldX = useSharedValue(0);
  const heldY = useSharedValue(0);
  const heldZ = useSharedValue(0);
  const heldSpin = useSharedValue(0);
  const isHolding = useSharedValue(false);

  const { width: screenW, height: screenH } = Dimensions.get('window');

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
          heldX={heldX}
          heldY={heldY}
          heldZ={heldZ}
          heldSpin={heldSpin}
          isHolding={isHolding}
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
              : `Step ${stepNumber} of ${totalSteps} · Drag a part onto the table`}
          </Text>
        )}
        {store.guidanceOn && held && !isScrewing && (
          <Text style={styles.heldHint}>Drag the bolt onto the glowing hole</Text>
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

      <PartTray
        definition={def}
        onPickupPart={handlePickup}
        dragControls={{ heldX, heldZ, isHolding, screenW, screenH }}
      />

      <JoystickShared outX={joyX} outY={joyY} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#6f8a68' },
  fill: { ...StyleSheet.absoluteFill },
  spotRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 4,
    borderColor: '#3ddc84',
    backgroundColor: 'rgba(61,220,132,0.18)',
  },
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