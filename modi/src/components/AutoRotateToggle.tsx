import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useAssemblyStore } from '../store/assemblyStore';

/**
 * Toggle between manual rotation (joystick) and auto-focus on the
 * current target part when a part is held.
 */
export function AutoRotateToggle() {
  const autoRotate = useAssemblyStore((s) => s.autoRotate);
  const toggleAutoRotate = useAssemblyStore((s) => s.toggleAutoRotate);

  return (
    <Pressable
      onPress={toggleAutoRotate}
      style={[styles.button, autoRotate && styles.buttonActive]}
    >
      <Text style={styles.icon}>🎥</Text>
      <Text style={[styles.label, autoRotate && styles.labelActive]}>
        {autoRotate ? 'Auto-view ON' : 'Auto-view'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  buttonActive: {
    backgroundColor: 'rgba(100,160,255,0.2)',
    borderColor: 'rgba(100,160,255,0.6)',
  },
  icon: { fontSize: 13 },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: '#64b4ff',
  },
});