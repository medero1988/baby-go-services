const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

/**
 * Extiende el webpack config por defecto de Nest (target: node, externals
 * vía webpack-node-externals para no empaquetar node_modules nativos como
 * bcrypt, ts-loader rule, etc.) para inlinear process.env.NODE_ENV como
 * literal. Con eso, cualquier `if (process.env.NODE_ENV !== 'production')`
 * se resuelve en build time y Terser (activo automáticamente en
 * mode: 'production') elimina la rama muerta del bundle final.
 *
 * Uso: NODE_ENV=production nest build --webpack
 */
module.exports = function (options) {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    ...options,
    mode: nodeEnv === 'production' ? 'production' : 'development',
    plugins: [
      ...options.plugins,
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(nodeEnv),
      }),
    ],
    // Nest usa los nombres de clase como tokens de DI (p.ej. `Payment.name`
    // en MongooseModule.forFeature vs `@InjectModel('Payment')`). Si Terser
    // los mangle, los tokens dejan de coincidir y la app no arranca.
    optimization: {
      ...options.optimization,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            keep_classnames: true,
            keep_fnames: true,
          },
        }),
      ],
    },
  };
};
