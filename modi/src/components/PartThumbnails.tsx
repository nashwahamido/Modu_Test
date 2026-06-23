import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  FilamentScene,
  FilamentView,
  Model,
  Camera,
  DefaultLight,
  useCameraManipulator,
  RenderCallback,
  Float3,
} from 'react-native-filament';
import { useSharedValue } from 'react-native-worklets-core';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LACK_ASSEMBLY } from '../data/lackAssembly';
import { JoystickShared } from './JoystickShared';

/**
 * Control scheme (minimal, docs-correct version):
 *   • Left thumb joystick   → rotates the MODEL (spin + tilt)
 *   • Right one-finger drag → slides the MODEL across the floor
 *   • Right two-finger pinch → zooms the camera
 *
 * Transform updates happen INSIDE the renderCallback worklet (per RNF docs),
 * reading joystick + drag shared values and writing the Model's rotate/translate
 * shared values. Uses the simple <Model> prop API (no useModel/transformManager).
 */
function Scene({
  joyX,
  joyY,
}: {
  joyX: ReturnType<typeof useSharedValue<number>>;
  joyY: ReturnType<typeof useSharedValue<number>>;
}) {
  const cameraManipulator = useCameraManipulator({
    orbitHomePosition: [0, 1.5, 5],
    targetPosition: [0, 0, 0],
    orbitSpeed: [0.003, 0.003],
  });

  const viewHeight = Dimensions.get('window').height;
  const viewWidth = Dimensions.get('window').width;

  // Model transform shared values (read by <Model> via props)
  const rotation = useSharedValue<Float3>([0, 0, 0]);
  const translation = useSharedValue<Float3>([0, 0, 0]);

  // Drag offset shared values, written by the pan gesture
  const slideX = useSharedValue(0);
  const slideZ = useSharedValue(0);

  // Accumulated rotation, persisted in the worklet across frames
  const accumSpin = useSharedValue(0);
  const accumTilt = useSharedValue(0);

  // Per-frame worklet: read joystick + drag shared values, update the
  // model's transform shared values. (No multiplyWithCurrentTransform here;
  // we set absolute rotation/translation each frame.)
  const renderCallback: RenderCallback = useCallback(() => {
    'worklet';
    accumSpin.value += joyX.value * 0.04;
    accumTilt.value += joyY.value * 0.04;
    const lim = Math.PI / 2;
    if (accumTilt.value > lim) accumTilt.value = lim;
    if (accumTilt.value < -lim) accumTilt.value = -lim;
    rotation.value = [accumTilt.value, accumSpin.value, 0];
    translation.value = [slideX.value, 0, slideZ.value];
  }, [joyX, joyY, slideX, slideZ, accumSpin, accumTilt, rotation, translation]);

  // Right one-finger drag → slide
  const dragStartX = useRef(0);
  const dragStartZ = useRef(0);
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => {
      dragStartX.current = slideX.value;
      dragStartZ.current = slideZ.value;
    })
    .onUpdate((e) => {
      slideX.value = dragStartX.current + e.translationX * 0.01;
      slideZ.value = dragStartZ.current + e.translationY * 0.01;
    });

  // Pinch zoom (camera)
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
      <FilamentView style={styles.filament} renderCallback={renderCallback}>
        <Camera cameraManipulator={cameraManipulator} />
        <DefaultLight />
        <Model
          source={{ uri: LACK_ASSEMBLY.glbUrl }}
          transformToUnitCube
          rotate={rotation}
          translate={translation}
          multiplyWithCurrentTransform={false}
        />
      </FilamentView>
    </GestureDetector>
  );
}

export function FilamentTestScreen() {
  const joyX = useSharedValue(0);
  const joyY = useSharedValue(0);

  return (
    <View style={styles.root}>
      <FilamentScene>
        <Scene joyX={joyX} joyY={joyY} />
      </FilamentScene>

      <JoystickShared outX={joyX} outY={joyY} />

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