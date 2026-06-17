import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';

interface JoystickProps {
  vector: React.MutableRefObject<{ x: number; y: number }>;
}

const MAX_R = 34;

export function Joystick({ vector }: JoystickProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  const setVector = (x: number, y: number) => {
    vector.current = { x, y };
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const r = Math.min(Math.hypot(e.translationX, e.translationY), MAX_R);
      const a = Math.atan2(e.translationY, e.translationX);
      tx.value = Math.cos(a) * r;
      ty.value = Math.sin(a) * r;
      runOnJS(setVector)(tx.value / MAX_R, ty.value / MAX_R);
    })
    .onEnd(() => {
      'worklet';
      tx.value = 0;
      ty.value = 0;
      runOnJS(setVector)(0, 0);
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
  zone: { position: 'absolute', bottom: 20, left: 20, width: 100, height: 100 },
  base: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});