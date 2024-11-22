const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverRuntimeConfig: {
    PROJECT_ROOT: __dirname,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        path: false,
      };
    }

    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(
              path.dirname(require.resolve('cesium')),
              'Build/Cesium'
            ),
            to: 'static/cesium',
          },
        ],
      })
    );

    return config;
  },
  transpilePackages: ['resium', 'cesium']
};

module.exports = nextConfig;

