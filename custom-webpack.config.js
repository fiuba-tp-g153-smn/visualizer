const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      $ENV: {
        BACKEND_BASE_URL: JSON.stringify(process.env.BACKEND_BASE_URL),
        USE_MOCK_TILES: JSON.stringify(process.env.USE_MOCK_TILES),
        TILE_FORMAT: JSON.stringify(process.env.TILE_FORMAT),
        APP_HOST_PORT: JSON.stringify(process.env.APP_HOST_PORT)
      }
    })
  ]
};
