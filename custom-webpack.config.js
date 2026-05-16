const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      $ENV: {
        DATA_SERVICE_BASE_URL: JSON.stringify(
          process.env.DATA_SERVICE_BASE_URL || 'https://data.mapasmn.com',
        ),
        ALERTS_SERVICE_BASE_URL: JSON.stringify(
          process.env.ALERTS_SERVICE_BASE_URL || 'http://localhost:8080',
        ),
        SMN_API_PROMPT_FOR_TOKEN: JSON.stringify(process.env.SMN_API_PROMPT_FOR_TOKEN || 'true'),
        TILE_FORMAT: JSON.stringify(process.env.TILE_FORMAT || 'webp'),
        APP_HOST_PORT: JSON.stringify(process.env.APP_HOST_PORT || '4200'),
        DOCS_URL: JSON.stringify(process.env.DOCS_URL || 'https://docs.mapasmn.com/visualizer/'),
      },
    }),
  ],
};
