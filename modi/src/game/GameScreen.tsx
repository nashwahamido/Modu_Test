// The 3D game screen — assembles the LACK table via react-native-filament.
import { useEffect, useRef, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { FilamentScene } from "react-native-filament";

// scene
import { AssemblyScene } from "@/game/scene/AssemblyScene";
// scene control
import { createOffsetDriver } from "@/game/scene/offsetDriver";
import { useSceneState } from "@/game/scene/useSceneState";

// input
import { Joystick } from "@/game/input/Joystick";
import { useOrbitCamera } from "@/game/input/useOrbitCamera";
import { usePartDrag } from "@/game/input/usePartDrag";
import { BeatControl } from "@/game/input/BeatControl";
import { TapControl } from "@/game/input/TapControl";
import { TightenControl } from "@/game/input/TightenControl";
import { RotateControl } from "@/game/input/RotateControl";

// assembly data
import { useGameStore } from "@/game/core/store";
import { LACK } from "@/game/furnitures/LACK";
import { instructionText } from "@/game/core/presentation/instructions";

// This screen assembles the LACK table.
const ACTIVE_FURNITURE = LACK;

// ui related
import { GreenFlash } from "@/game/ui/GreenFlash";
import { FitChip } from "@/game/ui/FitChip";
import { PartsTray } from "@/game/ui/PartsTray";
import { BaseStashControl } from "@/game/ui/BaseStashControl";
import { ResetButton } from "@/game/ui/ResetButton";
import { DevAutoStep } from "@/game/ui/DevAutoStep";
import { SettingsPanel } from "@/game/ui/SettingsPanel";

/** Compact on-screen toggle (bottom-right): Focus / Hints / Auto-View. */
function ToggleChip({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, on && styles.chipOn]}
      onPress={onToggle}
      hitSlop={6}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function GameScreen() {
  const {
    manipulator,
    onStickStart,
    onStickMove,
    onStickEnd,
    onZoomDelta,
    onPanStart,
    onPanMove,
    onPanEnd,
    resetCamera,
    getFocusPoint,
  } = useOrbitCamera();
  const lastScale = useRef(1);
  const sceneState = useSceneState();
  const heldDriver = useRef(createOffsetDriver()).current;
  const sinkDriver = useRef(createOffsetDriver()).current;

  useEffect(() => {
    if (!useGameStore.getState().furniture) useGameStore.getState().loadFurniture(ACTIVE_FURNITURE);
  }, []);

  // Primitive selectors only — object-returning selectors re-render forever.
  const furniture = useGameStore((s) => s.furniture);
  // The base-stash control is a multi-cluster feature (DALFRED's base/seat).
  // Single-cluster furniture like LACK must not show it — stashing would hide
  // the whole assembly during the fastener stage.
  const multiCluster = furniture
    ? new Set(Object.values(furniture.parts).map((p) => p.cluster)).size > 1
    : false;
  const stage = useGameStore((s) => s.stage());
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const firstAvailable = useGameStore((s) => s.available()[0]?.actionId);
  const completedCount = useGameStore((s) => s.completed.length);
  const orientationActionId = useGameStore((s) => s.orientationActionId);
  const heldActionId = useGameStore((s) => s.heldActionId);
  const undoneCount = useGameStore((s) => s.undoneActions.length);
  const [showSettings, setShowSettings] = useState(false);
  const totalCount = furniture?.actions.length ?? 0;
  const objectiveFontSize = Math.round(14 * settings.fontScale);
  const orientationAction = orientationActionId
    ? furniture?.actions.find((a) => a.actionId === orientationActionId)
    : null;
  const objective = furniture && firstAvailable
    ? instructionText(furniture.instructions, firstAvailable, settings.textLevel)
    : "All done!";

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      lastScale.current = 1;
    })
    .onUpdate((e) => {
      onZoomDelta(e.scale - lastScale.current);
      lastScale.current = e.scale;
    });

  // Two-finger drag pans the scene (strafe). A translation threshold keeps a
  // pinch (distance change, little centroid travel) from triggering it.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minPointers(2)
    // No averageTouches: track the primary finger so lifting the second one
    // doesn't snap the tracked point (which lurched the scene on release).
    .activeOffsetX([-22, 22])
    .activeOffsetY([-22, 22])
    .onStart((e) => onPanStart(e.x, e.y))
    // Ignore the centroid snap when a finger lifts (2→1) — that jump would
    // strafe the scene right before the gesture ends.
    .onUpdate((e) => {
      if (e.numberOfPointers >= 2) onPanMove(e.x, e.y);
    })
    .onEnd(() => onPanEnd())
    .onFinalize(() => onPanEnd());
  // Race, not Simultaneous: the gesture is EITHER a zoom or a pan, never both,
  // so a pinch no longer drifts the scene and a pan no longer changes zoom.
  const { gestureFor, canvasGesture, ringOverlay } = usePartDrag({
    manipulator,
    heldDriver,
    getFocusPoint,
    onPanStart,
    onPanMove,
    onPanEnd,
  });

  // One-finger canvas drag pans the table (or moves a floating part); two-finger
  // pan / pinch drive the camera. They never collide (different finger counts).
  const sceneGesture = Gesture.Race(pinch, pan, canvasGesture);

  if (!furniture) return <View style={styles.root} />;

  return (
    <ImageBackground
      source={require("../assets/images/studio-bg.png")}
      resizeMode="cover"
      style={styles.root}
    >
      <GestureDetector gesture={sceneGesture}>
        <View style={styles.sceneWrap}>
          <AssemblyScene
            cameraManipulator={manipulator}
            sceneState={sceneState}
            heldDriver={heldDriver}
            sinkDriver={sinkDriver}
          />
        </View>
      </GestureDetector>
      {settings.showHints ? (
        <View style={styles.objectiveBar} pointerEvents="none">
          <Text style={[styles.objectiveText, { fontSize: objectiveFontSize }]}>
            Stage {stage} · {objective} · {completedCount}/{totalCount}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${totalCount ? (completedCount / totalCount) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>
      ) : null}
      {settings.focusMode ? null : (
        <View style={styles.pointsChip} pointerEvents="none">
          <Text style={styles.pointsText}>★ {completedCount * furniture.xpPerStep}</Text>
        </View>
      )}
      <FitChip />
      <ResetButton />
      <PartsTray
        items={sceneState.trayItems}
        gestureFor={gestureFor}
        header={multiCluster ? <BaseStashControl /> : undefined}
        thumbs={furniture.thumbs}
      />
      {sceneState.activeTighten ? (
        sceneState.activeTighten.tool === "mallet" ? (
          <TapControl action={sceneState.activeTighten} sinkDriver={sinkDriver} />
        ) : (
          <TightenControl action={sceneState.activeTighten} sinkDriver={sinkDriver} />
        )
      ) : null}
      {orientationAction ? (
        <RotateControl action={orientationAction} />
      ) : null}
      {sceneState.activeBeat && !sceneState.activeTighten && !orientationAction && settings.showHints ? (
        <BeatControl action={sceneState.activeBeat} />
      ) : null}
      <View style={styles.joystickZone}>
        <Joystick onStart={onStickStart} onMove={onStickMove} onEnd={onStickEnd} />
      </View>
      <Pressable style={styles.recenterButton} onPress={resetCamera} hitSlop={8}>
        <Text style={styles.recenterText}>⟲ Recenter</Text>
      </Pressable>
      {heldActionId ? (
        <Pressable
          style={styles.putBackButton}
          onPress={() => useGameStore.getState().cancelHeld()}
          hitSlop={8}
        >
          <Text style={styles.putBackText}>↩ Put back</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={styles.settingsButton}
        onPress={() => setShowSettings(true)}
        hitSlop={8}
      >
        <Text style={styles.settingsIcon}>⚙</Text>
      </Pressable>
      <View style={styles.undoRedoRow}>
        <Pressable
          style={[styles.ctrlButton, completedCount === 0 && styles.ctrlDisabled]}
          onPress={() => useGameStore.getState().undoLastAction()}
          disabled={completedCount === 0}
          hitSlop={8}
        >
          <Text style={styles.ctrlText}>↶</Text>
        </Pressable>
        <Pressable
          style={[styles.ctrlButton, undoneCount === 0 && styles.ctrlDisabled]}
          onPress={() => useGameStore.getState().redoLastAction()}
          disabled={undoneCount === 0}
          hitSlop={8}
        >
          <Text style={styles.ctrlText}>↷</Text>
        </Pressable>
      </View>
      <View style={styles.togglesRow}>
        <ToggleChip
          label="Focus"
          on={settings.focusMode}
          onToggle={() => setSettings({ focusMode: !settings.focusMode })}
        />
        <ToggleChip
          label="Hints"
          on={settings.showHints}
          onToggle={() => setSettings({ showHints: !settings.showHints })}
        />
        <ToggleChip
          label="Auto-View"
          on={settings.autoView}
          onToggle={() => setSettings({ autoView: !settings.autoView })}
        />
      </View>
      {ringOverlay}
      <DevAutoStep heldDriver={heldDriver} sinkDriver={sinkDriver} />
      <GreenFlash trigger={completedCount} />
      {showSettings ? (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      ) : null}
    </ImageBackground>
  );
}

export default function GameScreenRoute() {
  return (
    <FilamentScene>
      <GameScreen />
    </FilamentScene>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#a8cfe0" },
  sceneWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  objectiveBar: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 18,
  },
  objectiveText: { fontSize: 14, color: "#2e2a24", fontWeight: "600" },
  progressTrack: {
    marginTop: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(60,50,40,0.15)",
    alignSelf: "stretch",
    overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: "#37c871" },
  pointsChip: {
    position: "absolute",
    top: 10,
    left: 14,
    backgroundColor: "rgba(255,255,255,0.75)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  pointsText: { fontSize: 13, fontWeight: "700", color: "#b8741a" },
  joystickZone: { position: "absolute", left: 28, bottom: 28 },
  recenterButton: {
    position: "absolute",
    left: 180,
    bottom: 70,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(60,50,40,0.15)",
  },
  recenterText: { fontSize: 12, fontWeight: "700", color: "#2e2a24" },
  settingsButton: {
    position: "absolute",
    top: 8,
    left: 92,
    backgroundColor: "rgba(255,255,255,0.75)",
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: { fontSize: 20, color: "#2e2a24" },
  undoRedoRow: { position: "absolute", top: 54, left: 14, flexDirection: "row", gap: 8 },
  ctrlButton: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 12,
    width: 42,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(60,50,40,0.15)",
  },
  ctrlDisabled: { opacity: 0.4 },
  ctrlText: { fontSize: 18, fontWeight: "700", color: "#2e2a24" },
  putBackButton: {
    position: "absolute",
    left: 14,
    top: 150,
    backgroundColor: "rgba(232,132,44,0.92)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(60,50,40,0.15)",
  },
  putBackText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  togglesRow: {
    position: "absolute",
    right: 14,
    bottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(60,50,40,0.15)",
  },
  chipOn: { backgroundColor: "#6f8a68", borderColor: "#6f8a68" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#2e2a24" },
  chipTextOn: { color: "#fff" },
});