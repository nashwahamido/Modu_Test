import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  FilamentScene,
  FilamentView,
  ModelRenderer,
  Camera,
  DefaultLight,
  useModel,
  useFilamentContext,
} from 'react-native-filament';
import { LACK_ASSEMBLY } from '../data/lackAssembly';

/**
 * PER-PART CONTROL PROOF TEST.
 *
 * Goal: prove Filament lets us control individual parts of the LACK model.
 * Once the model loads, we:
 *   1. HIDE one leg  (table_leg_00167768_001) via scene.removeEntity
 *   2. LIFT another leg (table_leg_00167768_005) up into the air via
 *      transformManager.setTransform on that single entity
 *
 * SUCCESS = the table shows with one leg missing and one leg floating above.
 * If that works, the full assembly (dismantle, drag, snap) is buildable.
 */
function Scene() {
  const model = useModel({ uri: LACK_ASSEMBLY.glbUrl });
  const { transformManager, scene, nameComponentManager } = useFilamentContext();
  const didApply = useRef(false);

  useEffect(() => {
    if (model.state !== 'loaded' || didApply.current) return;
    didApply.current = true;

    try {
      const asset = model.asset;

      // Correct names use SPACES (Blender export quirk): "table top_..."
      // and "table leg_...". Bolts use underscores ("115980_01").

      // 1) HIDE the whole tabletop — unmissable from any angle.
      const tabletop = asset.getFirstEntityByName('table top_00167769');
      if (tabletop != null) scene.removeEntity(tabletop);

      // 2) LIFT one leg 0.5m into the air.
      const legToLift = asset.getFirstEntityByName('table leg_00167768_005');
      if (legToLift != null) {
        const m = transformManager
          .createIdentityMatrix()
          .translate([0, 0.5, 0]);
        transformManager.setTransform(legToLift, m);
      }

      // eslint-disable-next-line no-console
      console.log(
        'PART TEST — tabletop hidden:',
        tabletop != null,
        '| leg lifted:',
        legToLift != null
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('PART TEST error:', e);
    }
  }, [model, transformManager, scene, nameComponentManager]);

  return (
    <FilamentView style={styles.filament}>
      <Camera />
      <DefaultLight />
      <ModelRenderer model={model} />
    </FilamentView>
  );
}

export function FilamentPartTest() {
  return (
    <View style={styles.root}>
      <FilamentScene>
        <Scene />
      </FilamentScene>
      <View style={styles.banner} pointerEvents="none">
        <Text style={styles.bannerText}>
          Part-control test — tabletop hidden, 1 leg lifted
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