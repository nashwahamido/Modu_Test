import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import {
  GestureDetector,
  Gesture,
  ScrollView,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { useSharedValue } from 'react-native-worklets-core';
import { AssemblyDefinition, AssemblyStep } from '../data/lackAssembly';
import { useAssemblyStore } from '../store/assemblyStore';

// Static part thumbnails rendered in Blender (transparent PNGs).
// Place the two files at: modi/assets/parts/bolt.png and leg.png
const BOLT_THUMB = require('../../assets/parts/bolt.png');
const LEG_THUMB = require('../../assets/parts/leg.png');

/**
 * When provided, pending chips can be DRAGGED onto the canvas: the part is
 * picked up and follows the finger in 3D (V2 Filament screen). When absent,
 * chips fall back to tap-to-pick-up (expo-gl / combined-Filament screens).
 *
 * heldX / heldZ are the same worklets-core shared values the Scene uses to
 * position the held part, so writing them here moves the part live.
 */
interface DragControls {
  heldX: ReturnType<typeof useSharedValue<number>>;
  heldZ: ReturnType<typeof useSharedValue<number>>;
  isHolding: ReturnType<typeof useSharedValue<boolean>>;
  screenW: number;
  screenH: number;
  /** How far (in world units) the part travels from screen-centre to edge. */
  rangeX?: number;
  rangeZ?: number;
}

interface TrayProps {
  definition: AssemblyDefinition;
  onPickupPart: (step: AssemblyStep) => void;
  dragControls?: DragControls;
}

/**
 * Right-side part tray.
 * Normal mode: shows all parts (locked ones are dimmed).
 * Focus mode: shows only the current pending part.
 * Pending parts can be dragged onto the canvas (or tapped to drop to centre).
 */
export function PartTray({ definition, onPickupPart, dragControls }: TrayProps) {
  const statuses = useAssemblyStore((s) => s.statuses);
  const focusMode = useAssemblyStore((s) => s.focusMode);

  const visibleSteps = focusMode
    ? definition.steps.filter((s: AssemblyStep) => statuses[s.id] === 'pending')
    : definition.steps;

  return (
    <View style={styles.tray} pointerEvents="box-none">
      {focusMode && <Text style={styles.focusLabel}>FOCUS</Text>}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleSteps.map((step: AssemblyStep) => {
          const status = statuses[step.id];
          const isPending = status === 'pending';
          const isBolt = step.partNumber === '115980';
          const thumbSource = isBolt ? BOLT_THUMB : LEG_THUMB;

          const chipStyle = [
            styles.chip,
            status === 'done' && styles.chipDone,
            status === 'locked' && styles.chipLocked,
            isPending && styles.chipActive,
          ];

          const chipInner = (
            <>
              <View style={styles.iconContainer}>
                <Image
                  source={thumbSource}
                  style={styles.thumb}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.partLabel}>{step.label}</Text>
              <Text style={styles.partNo}>#{step.partNumber}</Text>
              {status === 'done' && <Text style={styles.check}>✓</Text>}
              {isPending && (
                <Text style={styles.tapHint}>
                  {dragControls ? 'DRAG' : 'TAP'}
                </Text>
              )}
            </>
          );

          // ---- Drag-enabled path (V2): pending chips drag onto the canvas ----
          if (dragControls && isPending) {
            const { heldX, heldZ, isHolding, screenW, screenH } = dragControls;
            const rangeX = dragControls.rangeX ?? 1.6;
            const rangeZ = dragControls.rangeZ ?? 1.1;
            const halfW = screenW / 2;
            const halfH = screenH / 2;

            // Map the finger's absolute screen position to a world offset so
            // the part appears roughly under the finger. Activates on a small
            // horizontal pull (toward the canvas, which is left of the tray),
            // leaving vertical movement to the ScrollView.
            const pan = Gesture.Pan()
              .activeOffsetX([-15, 15])
              .onStart((e) => {
                'worklet';
                runOnJS(onPickupPart)(step);
                isHolding.value = true;
                heldX.value = ((e.absoluteX - halfW) / halfW) * rangeX;
                heldZ.value = ((e.absoluteY - halfH) / halfH) * rangeZ;
              })
              .onUpdate((e) => {
                'worklet';
                heldX.value = ((e.absoluteX - halfW) / halfW) * rangeX;
                heldZ.value = ((e.absoluteY - halfH) / halfH) * rangeZ;
              });

            // Plain tap drops the part to centre (accessibility fallback).
            const tap = Gesture.Tap().onEnd(() => {
              'worklet';
              runOnJS(onPickupPart)(step);
              isHolding.value = true;
              heldX.value = 0;
              heldZ.value = 0;
            });

            const chipGesture = Gesture.Exclusive(pan, tap);

            return (
              <GestureDetector key={step.id} gesture={chipGesture}>
                <View style={chipStyle}>{chipInner}</View>
              </GestureDetector>
            );
          }

          // ---- Tap-only fallback (other screens, or non-pending chips) ----
          return (
            <Pressable
              key={step.id}
              disabled={!isPending}
              onPress={() => {
                if (isPending) onPickupPart(step);
              }}
              style={chipStyle}
            >
              {chipInner}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    right: 8,
    top: 8,
    bottom: 8,
    width: 80,
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
    // TEMP: visible backing so we can confirm the tray renders
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
  },
  scrollContent: {
    gap: 6,
    paddingVertical: 4,
  },
  focusLabel: {
    color: '#64b4ff',
    fontSize: 9,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '700',
  },
  chip: {
    width: 76,
    height: 72,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipActive: {
    borderColor: 'rgba(100,160,255,0.7)',
    backgroundColor: 'rgba(100,160,255,0.15)',
  },
  chipDone: {
    borderColor: 'rgba(60,220,130,0.5)',
    backgroundColor: 'rgba(60,220,130,0.12)',
  },
  chipLocked: { opacity: 0.35 },
  iconContainer: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 44,
    height: 36,
  },
  partLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 9, marginTop: 2 },
  partNo: { color: 'rgba(255,255,255,0.4)', fontSize: 8 },
  check: {
    position: 'absolute',
    top: 4,
    right: 6,
    color: '#3ddc84',
    fontSize: 14,
  },
  tapHint: {
    position: 'absolute',
    bottom: 3,
    color: '#64b4ff',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1,
  },
});