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
}

export const LACK_ASSEMBLY: AssemblyDefinition = {
  modelId: 'LACK_30449908_55x55',
  modelName: 'LACK side table',
  glbUrl:
    'https://bvnmmhsfndqaykjsoowy.supabase.co/storage/v1/object/public/models/LACK_30449908_55x55.glb',
  baseMeshNames: ['Tabletop', 'Top_panel'],
  xpPerStep: 10,
  xpBonusOnComplete: 40,
  steps: [
    {
      id: 'bolt_0',
      partNumber: '115980',
      label: 'Hanger bolt',
      meshName: 'Screw_115980_1',
      socketName: 'Socket_corner_1',
      target: [-0.22, 0.04, -0.22] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'screwdriver',
      snapRadius: 0.07,
      instruction: 'Screw the hanger bolt into the front-left corner',
    },
    {
      id: 'bolt_1',
      partNumber: '115980',
      label: 'Hanger bolt',
      meshName: 'Screw_115980_2',
      socketName: 'Socket_corner_2',
      target: [0.22, 0.04, -0.22] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'screwdriver',
      snapRadius: 0.07,
      instruction: 'Screw the hanger bolt into the front-right corner',
    },
    {
      id: 'bolt_2',
      partNumber: '115980',
      label: 'Hanger bolt',
      meshName: 'Screw_115980_3',
      socketName: 'Socket_corner_3',
      target: [-0.22, 0.04, 0.22] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'screwdriver',
      snapRadius: 0.07,
      instruction: 'Screw the hanger bolt into the back-left corner',
    },
    {
      id: 'bolt_3',
      partNumber: '115980',
      label: 'Hanger bolt',
      meshName: 'Screw_115980_4',
      socketName: 'Socket_corner_4',
      target: [0.22, 0.04, 0.22] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'screwdriver',
      snapRadius: 0.07,
      instruction: 'Screw the hanger bolt into the back-right corner',
    },
    {
      id: 'leg_0',
      partNumber: '153551',
      label: 'Leg',
      meshName: 'Leg_153551_1',
      socketName: 'Screw_115980_1',
      target: [-0.22, -0.28, -0.22] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'hand',
      snapRadius: 0.08,
      instruction: 'Screw the leg onto the front-left hanger bolt',
    },
    {
      id: 'leg_1',
      partNumber: '153551',
      label: 'Leg',
      meshName: 'Leg_153551_2',
      socketName: 'Screw_115980_2',
      target: [0.22, -0.28, -0.22] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'hand',
      snapRadius: 0.08,
      instruction: 'Screw the leg onto the front-right hanger bolt',
    },
    {
      id: 'leg_2',
      partNumber: '153551',
      label: 'Leg',
      meshName: 'Leg_153551_3',
      socketName: 'Screw_115980_3',
      target: [-0.22, -0.28, 0.22] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'hand',
      snapRadius: 0.08,
      instruction: 'Screw the leg onto the back-left hanger bolt',
    },
    {
      id: 'leg_3',
      partNumber: '153551',
      label: 'Leg',
      meshName: 'Leg_153551_4',
      socketName: 'Screw_115980_4',
      target: [0.22, -0.28, 0.22] as [number, number, number],
      targetRotation: [0, 0, 0] as [number, number, number],
      tool: 'hand',
      snapRadius: 0.08,
      instruction: 'Screw the leg onto the back-right hanger bolt',
    },
  ],
};