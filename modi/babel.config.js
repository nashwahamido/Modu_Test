module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required by react-native-filament (react-native-worklets-core).
      ['react-native-worklets-core/plugin', { processNestedWorklets: true }],
      // Reanimated 4 uses react-native-worklets; its babel plugin MUST be last.
      'react-native-worklets/plugin',
    ],
  };
};