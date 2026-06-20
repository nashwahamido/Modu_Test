import React, { useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  FilamentScene,
  FilamentView,
  Model,
  Camera,
  DefaultLight,
  useCameraManipulator,
  Float3,
} from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LACK_ASSEMBLY } from '../data/lackAssembly';
import { Joystick } from './Joystick';

/**
 * MILESTONE 2.5 — final control scheme:
 *   • Left thumb joystick  → rotates the MODEL (spin + tilt)
 *   • Right one-finger drag → slides the MODEL across the floor (pan)
 *   • Right two-finger pinch → zooms the camera
 *
 * Camera orbit is removed; all rotation comes from the joystick.
 * Uses react-native-worklets-core shared values to drive the Model's
 * `rotate` and `translate` props every frame.
 */
function Scene({
  joystick,
}: {
  joystick: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const cameraManipulator = useCameraManipulator({
    orbitHomePosition: [0, 1.5, 5],
    targetPosition: [0, 0, 0],
    orbitSpeed: [0.003, 0.003],
  });

  const viewHeight = Dimensions.get('window').height;
  const viewWidth = Dimensions.get('window').width;

  // Model transform state (driven every frame)
  const rotation = useSharedValue<Float3>([0, 0, 0]); // [tiltX, spinY, 0] radians
  const translation = useSharedValue<Float3>([0, 0, 0]); // [x, 0, z] metres

  // Accumulators we update from JS (joystick ref + drag deltas)
  const spinY = useRef(0);
  const tiltX = useRef(0);
  const posX = useRef(0);
  const posZ = useRef(0);

  // Drive rotation from the joystick ref on every animation frame (JS side).
  // We poll the ref and write the shared values.
  React.useEffect(() => {
    let raf: number;
    const tick = () => {
      const v = joystick.current;
      if (v.x !== 0 || v.y !== 0) {
        spinY.current += v.x * 0.04; // left/right → spin around Y
        tiltX.current += v.y * 0.04; // up/down → tilt around X
        // clamp tilt so it can't flip fully over
        const lim = Math.PI / 2;
        if (tiltX.current > lim) tiltX.current = lim;
        if (tiltX.current < -lim) tiltX.current = -lim;
        rotation.value = [tiltX.current, spinY.current, 0];
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [joystick, rotation]);

  // Right one-finger drag → slide the model in world X/Z
  const dragStartX = useRef(0);
  const dragStartZ = useRef(0);
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      dragStartX.current = posX.current;
      dragStartZ.current = posZ.current;
    })
    .onUpdate((e) => {
      // screen X → world X; screen Y → world Z (across the floor)
      posX.current = dragStartX.current + e.translationX * 0.01;
      posZ.current = dragStartZ.current + e.translationY * 0.01;
      translation.value = [posX.current, 0, posZ.current];
    });

  // Pinch zoom (camera). ORBIT mode: negative = zoom in.
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
      <FilamentView style={styles.filament}>
        <Camera cameraManipulator={cameraManipulator} />
        <DefaultLight />
        <Model
          source={{ uri: LACK_ASSEMBLY.glbUrl }}
          transformToUnitCube
          rotate={rotation}
          translate={translation}
        />
      </FilamentView>
    </GestureDetector>
  );
}

export function FilamentTestScreen() {
  const joystick = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  return (
    <View style={styles.root}>
      <FilamentScene>
        <Scene joystick={joystick} />
      </FilamentScene>

      {/* Left-thumb joystick → model rotation */}
      <Joystick vector={joystick} />

      <View style={styles.banner} pointerEvents="none">
        <Text style={styles.bannerText}>
          M2.5 — joystick: rotate · drag: slide · pinch: zoom
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#6f8a68' },
  filament: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});