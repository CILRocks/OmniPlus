var webpack = require('webpack')
var path = require('path')
var CopyFilesPlugin = require('copy-webpack-plugin')
var UglifyJsPlugin = require('webpack-uglify-js-plugin')

module.exports = env => {
    const ENV = env.NODE_ENV
    const isDev = ENV === 'development'

    return {
        mode: ENV,
        devtool: isDev ? 'inline-source-map' : 'nosources-source-map',
        entry: {
            main: path.resolve(__dirname, 'src/js/main.ts')
        },
        output: {
            path: path.resolve(__dirname, `${ENV}/`),
            filename: 'js/[name].js'
        },

        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: 'babel-loader'
                }, {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: 'ts-loader'
                }, {
                    test: /\.json$/,
                    exclude: /node_modules/,
                    use: 'json-loader'
                }, {
                    test: /\.(png|jpg|jpeg|woff|woff2|eot|ttf|svg)$/,
                    use: 'url-loader'
                }
            ]
        },

        resolve: {
            extensions: ['.ts', '.js', '.es6', '.json']
        },

        plugins: [
            new CopyFilesPlugin([
                { from: 'src/manifest.json', to: `./manifest.json` },
                { from: 'src/_locales', to: `./_locales` },
                { from: 'src/img', to: `./img` },
            ], {
                ignore: [ '.*' ],
                copyUnmodified: true,
                debug: 'warning'
            }),
            new webpack.DefinePlugin({
                '$$TARGET$$': env.target
            }),
            ...(isDev ? [] : [
                new UglifyJsPlugin({
                    cacheFolder: path.resolve(__dirname, 'cache/uglify'),
                    debug: false,
                    minimize: true,
                    sourceMap: true,
                    output: {
                        comments: false
                    },
                    compressor: {
                        warnings: false
                    },
                    output: {
                        ascii_only: true,
                        beautify: false
                    }
                }),
                new webpack.DefinePlugin({
                    'process.env': {
                        NODE_ENV: ENV
                    }
                })
            ])
        ]
    }
}
