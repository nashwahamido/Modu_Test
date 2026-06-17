import { create } from 'zustand';
import { AssemblyDefinition, AssemblyStep } from '../data/lackAssembly';

export type SnapState = 'idle' | 'held' | 'near_rotation' | 'near_correct' | 'screwing';
export type PartStatus = 'locked' | 'pending' | 'done';

interface HeldPart {
  stepId: string;
  meshName: string;
}

interface AssemblyState {
  definition: AssemblyDefinition | null;
  statuses: Record<string, PartStatus>;
  currentStepIndex: number;
  held: HeldPart | null;
  snapState: SnapState;
  xp: number;
  guidanceOn: boolean;
  focusMode: boolean;
  autoRotate: boolean;
  completed: boolean;
  zoom: number;
  /** Rotation progress 0..1 during screwing phase */
  rotationProgress: number;

  init: (def: AssemblyDefinition) => void;
  currentStep: () => AssemblyStep | null;
  canPickUp: (stepId: string) => boolean;
  pickUp: (stepId: string, meshName: string) => void;
  setSnapState: (s: SnapState) => void;
  startScrewing: () => void;
  addRotation: (delta: number) => void;
  dropSuccess: () => void;
  dropCancel: () => void;
  toggleGuidance: () => void;
  toggleFocusMode: () => void;
  toggleAutoRotate: () => void;
  setZoom: (z: number) => void;
  reset: () => void;
}

export const useAssemblyStore = create<AssemblyState>((set, get) => ({
  definition: null,
  statuses: {},
  currentStepIndex: 0,
  held: null,
  snapState: 'idle',
  xp: 0,
  guidanceOn: true,
  focusMode: false,
  autoRotate: false,
  completed: false,
  zoom: 1,
  rotationProgress: 0,

  init: (def: AssemblyDefinition) => {
    const statuses: Record<string, PartStatus> = {};
    def.steps.forEach((s: AssemblyStep, i: number) => {
      statuses[s.id] = i === 0 ? 'pending' : 'locked';
    });
    set({
      definition: def,
      statuses,
      currentStepIndex: 0,
      held: null,
      snapState: 'idle',
      xp: 0,
      completed: false,
      rotationProgress: 0,
    });
  },

  currentStep: (): AssemblyStep | null => {
    const { definition, currentStepIndex } = get();
    if (!definition) return null;
    return definition.steps[currentStepIndex] ?? null;
  },

  canPickUp: (stepId: string) => get().statuses[stepId] === 'pending' && !get().held,

  pickUp: (stepId: string, meshName: string) => {
    if (!get().canPickUp(stepId)) return;
    set({ held: { stepId, meshName }, snapState: 'held', rotationProgress: 0 });
  },

  setSnapState: (s: SnapState) => set({ snapState: s }),

  startScrewing: () => set({ snapState: 'screwing', rotationProgress: 0 }),

  addRotation: (delta: number) => {
    const { rotationProgress } = get();
    const newProgress = Math.min(1, rotationProgress + delta);
    set({ rotationProgress: newProgress });
  },

  dropSuccess: () => {
    const { definition, currentStepIndex, held, statuses, xp } = get();
    if (!definition || !held) return;
    const newStatuses = { ...statuses, [held.stepId]: 'done' as PartStatus };
    const nextIndex = currentStepIndex + 1;
    const isComplete = nextIndex >= definition.steps.length;

    if (!isComplete) {
      newStatuses[definition.steps[nextIndex].id] = 'pending';
    }

    set({
      statuses: newStatuses,
      currentStepIndex: isComplete ? currentStepIndex : nextIndex,
      held: null,
      snapState: 'idle',
      rotationProgress: 0,
      xp:
        xp +
        definition.xpPerStep +
        (isComplete ? definition.xpBonusOnComplete : 0),
      completed: isComplete,
    });
  },

  dropCancel: () => set({ held: null, snapState: 'idle', rotationProgress: 0 }),

  toggleGuidance: () => set((s) => ({ guidanceOn: !s.guidanceOn })),

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),

  setZoom: (z: number) => set({ zoom: Math.max(0.5, Math.min(2.5, z)) }),

  reset: () => {
    const def = get().definition;
    if (def) get().init(def);
  },
}));