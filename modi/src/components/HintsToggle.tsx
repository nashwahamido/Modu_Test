import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useAssemblyStore } from '../store/assemblyStore';

/**
 * Toggle the instructional hint text (drag/screw prompts) on or off.
 * Uses the store's guidanceOn flag.
 */
export function HintsToggle() {
  const guidanceOn = useAssemblyStore((s) => s.guidanceOn);
  const toggleGuidance = useAssemblyStore((s) => s.toggleGuidance);

  return (
    <Pressable
      onPress={toggleGuidance}
      style={[styles.button, guidanceOn && styles.buttonActive]}
    >
      <Text style={[styles.label, guidanceOn && styles.labelActive]}>
        {guidanceOn ? 'Hints ON' : 'Hints'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  buttonActive: {
    backgroundColor: 'rgba(100,160,255,0.2)',
    borderColor: 'rgba(100,160,255,0.6)',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: '#64b4ff',
  },
});