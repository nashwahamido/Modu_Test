import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { useCameraManipulator } from "react-native-filament";
import { buildPartStage } from "@/game/core/assembly/targets";
import { clusterPivot } from "@/game/core/geometry/staging";
import { PartDef, Vec3 } from "@/game/core/type";
import { useGameStore } from "@/game/core/store";

const ORBIT_RATE = 220; // viewport px/s at full stick deflection
const ZOOM_RATE = 32; // scroll delta per unit pinch-scale change (user feel-tested)
const HOME_EYE: [number, number, number] = [1.0, 0.85, 1.0];

// Auto-View framing: drop the eye OUTSIDE the target corner, elevated and
// close, so the next hole/slot faces the camera up close. `dir` points from the
// assembly centre out toward the hole; the camera sits back along it and above.
// Both are world metres — tune for how tight the auto-view zoom feels.
const AUTO_BACK = 0.7;
const AUTO_HEIGHT = 0.5;
function framingEye(
  center: [number, number, number],
  target: [number, number, number],
): [number, number, number] {
  let dx = target[0] - center[0];
  let dz = target[2] - center[2];
  let len = Math.hypot(dx, dz);
  if (len < 1e-4) {
    // Hole sits over the centre (degenerate) — view from +Z.
    dx = 0;
    dz = 1;
    len = 1;
  }
  dx /= len;
  dz /= len;
  return [
    target[0] + dx * AUTO_BACK,
    target[1] + AUTO_HEIGHT,
    target[2] + dz * AUTO_BACK,
  ];
}

/**
 * Camera orbit pivot for a stage: the vertical centre of what's visible. When
 * the base cluster is set aside during the seat build (stage 3), frame just
 * the seat assembly; otherwise frame everything built up to and including the
 * stage.
 */
function pivotFor(
  parts: Record<string, PartDef>,
  partStage: Record<string, number>,
  stage: number,
  activeCluster: string | null,
  focusPoint: Vec3 | null,
  focusPartId: string | null,
  focusCluster: string | null,
): Vec3 {
  if (focusPoint) return focusPoint;
  if (focusPartId && parts[focusPartId]) return clusterPivot([parts[focusPartId]]);
  if (focusCluster) {
    const clusterParts = Object.values(parts).filter((p) => p.cluster === focusCluster);
    if (clusterParts.length) return clusterPivot(clusterParts);
  }

  const seatOnly = stage === 3 && activeCluster === "base";
  const used = Object.values(parts).filter((p) =>
    seatOnly ? p.cluster === "seat" : (partStage[p.partId] ?? 9) <= stage,
  );
  return clusterPivot(used.length ? used : Object.values(parts));
}

/**
 * Rate-control orbit: while the stick is deflected, a 16ms loop feeds
 * accumulated viewport deltas into the manipulator's grab session.
 * Pinch scale deltas map to scroll() zoom.
 *
 * The orbit pivot tracks the centre of the assembly built so far (per
 * stage). Filament manipulators take their target at construction, so a
 * pivot change recreates the manipulator; the current eye position is
 * carried over so only the gaze re-aims.
 */
export function useOrbitCamera() {
  const stage = useGameStore((s) => s.stage());
  const activeCluster = useGameStore((s) => s.activeCluster);
  const examine = useGameStore((s) => s.examine);
  const heldActionId = useGameStore((s) => s.heldActionId);
  const furniture = useGameStore((s) => s.furniture);
  const targetRef = useRef<[number, number, number]>([0, 0, 0]);
  const partStage = useMemo(
    () => (furniture ? buildPartStage(furniture.actions) : {}),
    [furniture],
  );
  const heldFocusPoint = useMemo<Vec3 | null>(() => {
    if (!furniture || !heldActionId) return null;
    const action = furniture.actions.find((a) => a.actionId === heldActionId);
    if (!action?.partId) return null;
    return targetRef.current;
  }, [furniture, heldActionId]);
  const focusPartId = examine?.kind === "part" ? examine.partId : null;
  const focusCluster = examine?.kind === "cluster" ? examine.cluster : null;
  // Auto-View: when on (and not examining or holding), frame the next open
  // target socket so the next thing to do is always in view.
  const autoView = useGameStore((s) => s.settings.autoView);
  const nextTargetPartId = useGameStore((s) => {
    const a = s
      .available()
      .find((x) => x.partId && (x.type === "snapPart" || x.type === "insertFastener"));
    return a?.partId ?? null;
  });
  const autoFocusPartId =
    focusPartId ?? (autoView && !heldActionId ? nextTargetPartId : null);
  // When auto-view (not examine / not holding) is driving the focus, we also
  // orbit the eye to frame that hole — not just re-aim the gaze.
  const autoFrame =
    autoView && !heldActionId && !focusPartId ? nextTargetPartId : null;
  const pivot = useCallback(
    (
      st: number,
      cl: string | null,
      point: Vec3 | null,
      partId: string | null,
      cluster: string | null,
    ): [number, number, number] => {
      const p = furniture
        ? pivotFor(furniture.parts, partStage, st, cl, point, partId, cluster)
        : ([0, 0, 0] as Vec3);
      // Follow the table-top origin shift so the camera frames the assembly
      // wherever it was placed.
      const ws = useGameStore.getState().worldShift;
      return [p[0] + ws[0], p[1] + ws[1], p[2] + ws[2]];
    },
    [furniture, partStage],
  );

  const eyeRef = useRef<[number, number, number]>(HOME_EYE);
  const resetTick = useRef(0);
  const panning = useRef(false);
  const { height: winH } = useWindowDimensions();
  const [home, setHome] = useState(() => ({
    eye: HOME_EYE,
    target: pivot(stage, activeCluster, heldFocusPoint, autoFocusPartId, focusCluster),
  }));

  useEffect(() => {
    targetRef.current = home.target;
  }, [home.target]);

  const manipulator = useCameraManipulator({
    orbitHomePosition: home.eye,
    targetPosition: home.target,
    orbitSpeed: [0.005, 0.005],
  });

  const captureEye = useCallback(() => {
    const la = manipulator?.getLookAt();
    if (la) eyeRef.current = [la[0][0], la[0][1], la[0][2]];
  }, [manipulator]);

  useEffect(() => {
    const nextTarget = pivot(
      stage,
      activeCluster,
      heldFocusPoint,
      autoFocusPartId,
      focusCluster,
    );
    // Auto-view: orbit the eye to frame the hole. Otherwise keep the current
    // eye (carry the user's orbit) and only re-aim at the new target.
    const nextEye = autoFrame
      ? framingEye(pivot(stage, activeCluster, null, null, null), nextTarget)
      : eyeRef.current;
    setHome((h) =>
      h.target.every((v, i) => Math.abs(v - nextTarget[i]) < 1e-5) &&
      h.eye.every((v, i) => Math.abs(v - nextEye[i]) < 1e-5)
        ? h
        : { eye: nextEye, target: nextTarget },
    );
  }, [stage, activeCluster, heldFocusPoint, autoFocusPartId, focusCluster, pivot, autoFrame]);

  const stick = useRef({ x: 0, y: 0 });
  const grab = useRef({ active: false, x: 0, y: 0 });

  useEffect(() => {
    const tick = setInterval(() => {
      const g = grab.current;
      if (!g.active || !manipulator || panning.current) return;
      // Stick direction maps one-to-one to orbit direction (push right →
      // rotate right, push up → rotate up).
      g.x -= stick.current.x * ORBIT_RATE * 0.016;
      g.y -= stick.current.y * ORBIT_RATE * 0.016;
      manipulator.grabUpdate(g.x, g.y);
    }, 16);
    return () => clearInterval(tick);
  }, [manipulator]);

  const onStickStart = useCallback(() => {
    grab.current = { active: true, x: 0, y: 0 };
    manipulator?.grabBegin(0, 0, false);
  }, [manipulator]);

  const onStickMove = useCallback((x: number, y: number) => {
    stick.current = { x, y };
  }, []);

  const onStickEnd = useCallback(() => {
    grab.current.active = false;
    stick.current = { x: 0, y: 0 };
    manipulator?.grabEnd();
    captureEye();
  }, [manipulator, captureEye]);

  const onZoomDelta = useCallback(
    (scaleDelta: number) => {
      manipulator?.scroll(0, 0, -scaleDelta * ZOOM_RATE);
      captureEye();
    },
    [manipulator, captureEye],
  );

  // Two-finger pan (strafe grab): translates the scene laterally so the player
  // can see around parts. Pauses the orbit tick while active.
  // Touch Y is top-left origin; the manipulator viewport is bottom-left, so a
  // raw feed pans inverted. Mirror Y by the screen height — the constant
  // cancels in the strafe delta, so direction flips without changing speed.
  const onPanStart = useCallback(
    (x: number, y: number) => {
      if (grab.current.active) return; // don't fight an active joystick orbit
      panning.current = true;
      manipulator?.grabBegin(x, winH - y, true);
    },
    [manipulator, winH],
  );
  const onPanMove = useCallback(
    (x: number, y: number) => {
      if (panning.current) manipulator?.grabUpdate(x, winH - y);
    },
    [manipulator, winH],
  );
  const onPanEnd = useCallback(() => {
    if (!panning.current) return;
    panning.current = false;
    manipulator?.grabEnd();
    captureEye();
  }, [manipulator, captureEye]);

  // Recenter to the default eye + current stage pivot. The manipulator bakes
  // its pose at construction, so we recreate it; an alternating epsilon on the
  // target guarantees the config value changes even when nominally at home.
  const resetCamera = useCallback(() => {
    resetTick.current += 1;
    const target = pivot(stage, activeCluster, heldFocusPoint, focusPartId, focusCluster);
    eyeRef.current = HOME_EYE;
    setHome({
      eye: HOME_EYE,
      target: [
        target[0],
        target[1] + (resetTick.current % 2) * 1e-4,
        target[2],
      ],
    });
  }, [stage, activeCluster, heldFocusPoint, focusPartId, focusCluster, pivot]);

  const getFocusPoint = useCallback((): Vec3 => targetRef.current, []);

  return {
    manipulator,
    getFocusPoint,
    onStickStart,
    onStickMove,
    onStickEnd,
    onZoomDelta,
    onPanStart,
    onPanMove,
    onPanEnd,
    resetCamera,
  };
}