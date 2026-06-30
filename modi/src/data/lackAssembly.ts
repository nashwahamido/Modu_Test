export type ToolKind = 'screwdriver' | 'hammer' | 'allen_key' | 'hand';

export interface AssemblyStep {
  id: string;
  partNumber: string;
  label: string;
  meshName: string;
  socketName: string;
  target: [number, number, number];
  targetRotation: [number, number, number];
  tool: ToolKind;
  snapRadius: number;
  instruction: string;
}

export interface AssemblyDefinition {
  modelId: string;
  modelName: string;
  glbUrl: string;
  baseMeshNames: string[];
  steps: AssemblyStep[];
  xpPerStep: number;
  xpBonusOnComplete: number;
  // Standalone part models loaded independently when a part is held, so the
  // held part is NOT a child of the table root (won't rotate with the table).
  // Bundled assets: require(...) resolves to a numeric asset id that
  // react-native-filament's useModel accepts directly as a source.
  boltModel: number;
  legModel: number;
  tabletopModel: number;
}

export const LACK_ASSEMBLY: AssemblyDefinition = {
  modelId: 'LACK_30449908_55x55',
  modelName: 'LACK side table',
  glbUrl:
    'https://bvnmmhsfndqaykjsoowy.supabase.co/storage/v1/object/public/models/LACK_30449908_55x55.glb',
  // Only the tabletop stays visible at start
  baseMeshNames: ['table top_00167769'],
  // Standalone part models, bundled locally in assets/models/ — loaded
  // independently when a part is held, so the held part is NOT a child of the
  // table root. (Path is relative to this file: src/data → ../../assets.)
  boltModel: require('../../assets/models/Bolt.glb'),
  legModel: require('../../assets/models/Leg.glb'),
  tabletopModel: require('../../assets/models/Tabletop.glb'),
  xpPerStep: 10,
  xpBonusOnComplete: 40,
  steps: [
    // ---- Phase 1: hanger bolts (115980) ----
    {
      id: 'bolt_0',
      partNumber: '115980',
      label: 'Hanger bolt',
      meshName: '115980_01',
      socketName: 'table top_00167769',
      target: [0, 0, 0] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'screwdriver',
      snapRadius: 0.07,
      instruction: 'Screw the hanger bolt into corner 1',
    },
    {
      id: 'bolt_1',
      partNumber: '115980',
      label: 'Hanger bolt',
      meshName: '115980_02',
      socketName: 'table top_00167769',
      target: [0, 0, 0] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'screwdriver',
      snapRadius: 0.07,
      instruction: 'Screw the hanger bolt into corner 2',
    },
    {
      id: 'bolt_2',
      partNumber: '115980',
      label: 'Hanger bolt',
      meshName: '115980_03',
      socketName: 'table top_00167769',
      target: [0, 0, 0] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'screwdriver',
      snapRadius: 0.07,
      instruction: 'Screw the hanger bolt into corner 3',
    },
    {
      id: 'bolt_3',
      partNumber: '115980',
      label: 'Hanger bolt',
      meshName: '115980_04',
      socketName: 'table top_00167769',
      target: [0, 0, 0] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'screwdriver',
      snapRadius: 0.07,
      instruction: 'Screw the hanger bolt into corner 4',
    },
    // ---- Phase 2: legs (00167768) ----
    {
      id: 'leg_0',
      partNumber: '00167768',
      label: 'Leg',
      meshName: 'table leg_00167768_001',
      socketName: '115980_01',
      target: [0, 0, 0] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'hand',
      snapRadius: 0.08,
      instruction: 'Attach the leg to corner 1',
    },
    {
      id: 'leg_1',
      partNumber: '00167768',
      label: 'Leg',
      meshName: 'table leg_00167768_005',
      socketName: '115980_02',
      target: [0, 0, 0] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'hand',
      snapRadius: 0.08,
      instruction: 'Attach the leg to corner 2',
    },
    {
      id: 'leg_2',
      partNumber: '00167768',
      label: 'Leg',
      meshName: 'table leg_00167768_006',
      socketName: '115980_03',
      target: [0, 0, 0] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'hand',
      snapRadius: 0.08,
      instruction: 'Attach the leg to corner 3',
    },
    {
      id: 'leg_3',
      partNumber: '00167768',
      label: 'Leg',
      meshName: 'table leg_00167768_007',
      socketName: '115980_04',
      target: [0, 0, 0] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'hand',
      snapRadius: 0.08,
      instruction: 'Attach the leg to corner 4',
    },
  ],
};