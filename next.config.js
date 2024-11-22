const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

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
              'node_modules/cesium/Build/Cesium'
            ),
            to: '../public/cesium'
          }
        ]
      })
    );

    config.plugins.push(
      new webpack.DefinePlugin({
        CESIUM_BASE_URL: JSON.stringify('/cesium')
      })
    );

    return config;
  },
  transpilePackages: ['resium', 'cesium'],
  async rewrites() {
    return [
      {
        source: '/cesium/:path*',
        destination: '/cesium/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

