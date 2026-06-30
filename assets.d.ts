// Lets TypeScript understand `require('./model.glb')` (Metro resolves these to
// a numeric asset id at build time; react-native-filament accepts that number
// directly as a model source).
declare module '*.glb' {
  const asset: number;
  export = asset;
}

declare module '*.gltf' {
  const asset: number;
  export = asset;
}