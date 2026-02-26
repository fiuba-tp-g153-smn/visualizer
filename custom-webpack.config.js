const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      $ENV: {
        BACKEND_BASE_URL: JSON.stringify(
          process.env.BACKEND_BASE_URL || 'https://data.mapasmn.com',
        ),
        TILE_FORMAT: JSON.stringify(process.env.TILE_FORMAT || 'webp'),
        APP_HOST_PORT: JSON.stringify(process.env.APP_HOST_PORT || '4200'),
        DOCS_URL: JSON.stringify(process.env.DOCS_URL || 'https://docs.mapasmn.com/visualizer/'),
      },
    }),
  ],
};
