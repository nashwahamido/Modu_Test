# Modu — Migration & Setup

## What changed from Modu-Tests
- SDK 51 → SDK 56
- Added expo-router file-based routing
- Locked landscape orientation via expo-screen-orientation
- GLB loads from Supabase URL (no local asset needed)
- ADHD Focus Mode toggle added
- Parts tray positioned on right side, vertically centred

## Install new dependencies

Run these in your `modi` folder:

```bash
npx expo install expo-screen-orientation
npx expo install expo-haptics
npm install three @react-three/fiber @react-three/drei
npm install @types/three --save-dev
```

## Copy files

Copy these into your `modi` project:

```
src/
  app/
    _layout.tsx       ← replace existing
    index.tsx         ← replace existing
  components/
    AssemblyScene.tsx ← new
    AssemblyScreen.tsx← new
    PartTray.tsx      ← new
    Tool.tsx          ← new
    Joystick.tsx      ← new
    FocusModeToggle.tsx ← new (ADHD feature)
  store/
    assemblyStore.ts  ← new
  data/
    lackAssembly.ts   ← new
  hooks/
    useAssemblyGestures.ts ← new

app.json              ← replace existing
metro.config.js       ← replace existing
```

## Rebuild dev client

Since new native modules were added (expo-screen-orientation):

```bash
eas build --profile development --platform android
```

Install the new APK on your phone, then:

```bash
npx expo start --dev-client
```

## ADHD Focus Mode

Tap the 🎯 Focus button (bottom right of screen, above the part tray).

**Focus ON:**
- Only the current active part shows in the tray
- Phase label and step counter hidden
- XP counter hidden
- Instruction simplified to just the action

**Focus OFF:** Full UI restored.