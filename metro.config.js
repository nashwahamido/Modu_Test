const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Tell Metro about 3D model + texture assets
config.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'];
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'glb',
  'gltf',
  'obj',
  'mtl',
  'png',
  'jpg',
];

module.exports = config;