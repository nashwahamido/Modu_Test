import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { AssemblyDefinition, AssemblyStep } from '../data/lackAssembly';
import { useAssemblyStore } from '../store/assemblyStore';

interface TrayProps {
  definition: AssemblyDefinition;
  onPickupPart: (step: AssemblyStep) => void;
}

/**
 * Right-side part tray.
 * Normal mode: shows all parts (locked ones are dimmed).
 * Focus mode: shows only the current pending part.
 * Tapping a pending part picks it up.
 */
export function PartTray({ definition, onPickupPart }: TrayProps) {
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
          return (
            <Pressable
              key={step.id}
              disabled={!isPending}
              onPress={() => {
                if (isPending) onPickupPart(step);
              }}
              style={[
                styles.chip,
                status === 'done' && styles.chipDone,
                status === 'locked' && styles.chipLocked,
                isPending && styles.chipActive,
              ]}
            >
              <View style={styles.iconContainer}>
                {step.partNumber === '115980' ? (
                  <ScrewIcon />
                ) : (
                  <LegIcon />
                )}
              </View>
              <Text style={styles.partLabel}>{step.label}</Text>
              <Text style={styles.partNo}>#{step.partNumber}</Text>
              {status === 'done' && <Text style={styles.check}>✓</Text>}
              {isPending && <Text style={styles.tapHint}>TAP</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Simple screw icon drawn with RN views */
function ScrewIcon() {
  return (
    <View style={styles.screwIcon}>
      <View style={styles.screwHead} />
      <View style={styles.screwShaft} />
    </View>
  );
}

/** Simple leg icon drawn with RN views */
function LegIcon() {
  return (
    <View style={styles.legIcon}>
      <View style={styles.legBar} />
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
    width: 40,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Screw icon
  screwIcon: { alignItems: 'center' },
  screwHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(200,200,210,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  screwShaft: {
    width: 3,
    height: 14,
    backgroundColor: 'rgba(180,180,190,0.5)',
    borderRadius: 1,
  },
  // Leg icon
  legIcon: { alignItems: 'center' },
  legBar: {
    width: 8,
    height: 26,
    backgroundColor: 'rgba(200,200,210,0.5)',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});