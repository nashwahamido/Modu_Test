const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow importing 3D model + filament asset files as bundled assets so they can
// be loaded with require(...) via react-native-filament's useModel.
config.resolver.assetExts.push('glb', 'gltf', 'ktx', 'filamat');

module.exports = config;