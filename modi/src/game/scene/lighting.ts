// Lighting rig for the assembly scene — tuned toward a stylised-PBR look:
// warm key, strong cool rim for bright silhouette edges, gentle fill, and a
// low image-based ambient so the form reads with contrast and drama (vs. the
// old flat, evenly-lit setup). All values physical (lux / Kelvin); tune freely.

// Fallback colour behind the (transparent) Filament view before the bg paints.
export const SCENE_BACKGROUND = '#a8cfe0';

/**
 * Ambient/reflection from the image-based light. Kept LOW on purpose — high IBL
 * flattens everything; lowering it lets the key/rim sculpt the parts. Raise
 * toward ~30000 if the shadow side goes too dark.
 */
export const IBL_INTENSITY = 20_000;

/** KEY — warm, from upper-front-left, casts shadows. The main sculpting light. */
export const KEY_LIGHT = {
  colorKelvin: 4_800,
  intensity: 90_000,
  direction: [-0.5, -1, -0.6] as [number, number, number],
};

/** FILL — cool, opposite side, no shadows; just opens the dark side a little. */
export const FILL_LIGHT = {
  colorKelvin: 7_600,
  intensity: 15_000,
  direction: [0.6, -0.45, 0.5] as [number, number, number],
};

/**
 * RIM — strong cool back-light that carves the bright edge you see in the
 * reference robots and lifts the part off the backdrop. This is what gives the
 * "edge glow" — raise intensity for a hotter rim, lower for subtler.
 */
export const RIM_LIGHT = {
  colorKelvin: 7_800,
  intensity: 64_000,
  direction: [0.3, -0.25, 0.85] as [number, number, number],
};