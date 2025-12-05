module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@contexts': './src/contexts',
            '@api': './src/api',
            '@hooks': './src/hooks',
            '@storage': './src/storage',
            '@src': './src'
          }
        }
      ]
    ]
  };
};
