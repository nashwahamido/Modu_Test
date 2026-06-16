import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export interface GestureCallbacks {
  onPickupProgress: (progress: number, x: number, y: number) => void;
  onPickupComplete: (x: number, y: number) => void;
  onPickupCancel: () => void;
  onHeldMove: (x: number, y: number) => void;
  onRelease: () => void;
}

const LONG_PRESS_MS = 350;

export function useAssemblyGestures(cb: GestureCallbacks) {
  return useMemo(() => {
    const longPress = Gesture.LongPress()
      .minDuration(LONG_PRESS_MS)
      .maxDistance(12)
      .onBegin((e) => {
        'worklet';
        runOnJS(cb.onPickupProgress)(0, e.x, e.y);
      })
      .onStart((e) => {
        'worklet';
        runOnJS(cb.onPickupComplete)(e.x, e.y);
      })
      .onFinalize((_e, success) => {
        'worklet';
        if (!success) runOnJS(cb.onPickupCancel)();
      });

    const pan = Gesture.Pan()
      .onUpdate((e) => {
        'worklet';
        runOnJS(cb.onHeldMove)(e.x, e.y);
      })
      .onEnd(() => {
        'worklet';
        runOnJS(cb.onRelease)();
      });

    const pickup = Gesture.Exclusive(longPress, pan);
    const scene = Gesture.Simultaneous(pickup);

    return { sceneGesture: scene, panRef: pan, longPressRef: longPress };
  }, [cb]);
}