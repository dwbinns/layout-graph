const { cpSync, rmSync } = require('fs');
const path = require('path');

rmSync("./dist", { recursive: true, force: true });
cpSync("./static", "./dist", { recursive: true });

module.exports = [
    {
        mode: 'development',
        devtool: 'eval-source-map',
        experiments: {
            outputModule: true,
            topLevelAwait: true,
        },
        entry: './src/index.js',
        output: {
            publicPath: "/",
            filename: 'index.js',
            path: path.resolve(__dirname, 'dist'),
        },
        devServer: {
            static: 'static',
            port: 8492,
        }
    }
];