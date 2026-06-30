// Lighting rig for the assembly scene.
//
// The parts already carry full PBR materials (IKEA albedo + normal maps), so a
// believable look comes from the light rig + environment, not the meshes. This
// is a 3-point rig over the default image-based light:
//   • KEY  — warm, casts shadows, sculpts the main form.
//   • FILL — cool, opposite side, no shadows, opens up the dark side.
//   • RIM  — from behind, separates the part from the background.
// All values are physical (lux / Kelvin); treat them as starting points to taste.

// Fallback colour shown behind the (transparent) Filament view before the
// background image paints. Kept roughly matching the studio backdrop.
export const SCENE_BACKGROUND = '#a8cfe0';

/** Ambient/reflection level from the image-based light. */
export const IBL_INTENSITY = 38_000;

export const KEY_LIGHT = {
  colorKelvin: 5_200,
  intensity: 78_000,
  direction: [-0.5, -1, -0.6] as [number, number, number],
};

/** Cool fill from the opposite side; no shadows — softens the key's shadow side. */
export const FILL_LIGHT = {
  colorKelvin: 7_200,
  intensity: 22_000,
  direction: [0.6, -0.45, 0.5] as [number, number, number],
};

/** Back/rim light to carve a bright edge and lift the part off the backdrop. */
export const RIM_LIGHT = {
  colorKelvin: 6_500,
  intensity: 34_000,
  direction: [0.35, -0.3, 0.7] as [number, number, number],
};
