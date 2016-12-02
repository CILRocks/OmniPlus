/// <reference path="typings/index.d.ts" />

var fs = require('fs');
var webpack = require('webpack');
var path = require('path');
var CopyFilesPlugin = require('copy-webpack-plugin');
var UglifyJsPlugin = require('webpack-uglify-js-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
    devtool: 'source-map',
    entry: {
        main: path.resolve(__dirname, 'src/js/main.ts')
    },
    output: {
        path: path.resolve(__dirname, 'dist/js'),
        filename: '[name].js'
    },

    module: {
        loaders: [
            {
                test: /\.less$/,
                loader: ExtractTextPlugin.extract("style-loader", "css-loader!less-loader")
            },
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                loader: 'ts-loader'
            },
            {
                test: /\.json$/,
                loader: 'json-loader'
            },
            {
                test: /\.(png|woff|woff2|eot|ttf|svg)$/,
                loader: 'url-loader?limit=100000'
            }
        ]
    },

    resolve: {
        extensions: ['', '.js', '.es6', 'json', 'ts', 'less']
    },

    plugins: [
        new CopyFilesPlugin([
            { from: 'src/manifest.json', to: path.resolve(__dirname, 'dist/manifest.json') },
            { from: 'src/_locales', to: path.resolve(__dirname, 'dist/_locales') },
            { from: 'src/img', to: path.resolve(__dirname, 'dist/img') },
        ], {
            ignore: [
                '.*',
            ],
            copyUnmodified: true,
            debug: 'warning'
        }),
        new UglifyJsPlugin({
            cacheFolder: path.resolve(__dirname, 'public/chached_uglify'),
            debug: true,
            minimize: false,
            sourceMap: true,
            output: {
                comments: false
            },
            compressor: {
                warnings: false
            }
        }),
        new ExtractTextPlugin('[name].css')
    ]
}