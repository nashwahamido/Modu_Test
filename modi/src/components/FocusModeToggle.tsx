import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useAssemblyStore } from '../store/assemblyStore';

/**
 * Toggle Focus Mode — hides non-essential UI to reduce visual clutter,
 * showing only the current step and part.
 */
export function FocusModeToggle() {
  const focusMode = useAssemblyStore((s) => s.focusMode);
  const toggleFocusMode = useAssemblyStore((s) => s.toggleFocusMode);

  return (
    <Pressable
      onPress={toggleFocusMode}
      style={[styles.button, focusMode && styles.buttonActive]}
    >
      <Text style={[styles.label, focusMode && styles.labelActive]}>
        {focusMode ? 'Focus ON' : 'Focus'}
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