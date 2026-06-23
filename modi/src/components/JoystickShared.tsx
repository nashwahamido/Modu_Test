import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue as useReaSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import type { useSharedValue } from 'react-native-worklets-core';

interface Props {
  // worklets-core shared values that the Filament render worklet reads
  outX: ReturnType<typeof useSharedValue<number>>;
  outY: ReturnType<typeof useSharedValue<number>>;
}

const MAX_R = 34;

/**
 * Same look as the original Joystick, but writes its normalized vector
 * into react-native-worklets-core shared values (outX/outY) so the Filament
 * renderCallback worklet can read them safely. Avoids JS-thread writes.
 */
export function JoystickShared({ outX, outY }: Props) {
  const tx = useReaSharedValue(0);
  const ty = useReaSharedValue(0);

  // Writing a plain number to a worklets-core shared value from JS is safe.
  const push = (x: number, y: number) => {
    outX.value = x;
    outY.value = y;
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const r = Math.min(Math.hypot(e.translationX, e.translationY), MAX_R);
      const a = Math.atan2(e.translationY, e.translationX);
      tx.value = Math.cos(a) * r;
      ty.value = Math.sin(a) * r;
      runOnJS(push)(tx.value / MAX_R, ty.value / MAX_R);
    })
    .onEnd(() => {
      'worklet';
      tx.value = 0;
      ty.value = 0;
      runOnJS(push)(0, 0);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <View style={styles.zone} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <View style={styles.base}>
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 110,
    height: 110,
    zIndex: 1000,
    elevation: 1000,
  },
  base: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});