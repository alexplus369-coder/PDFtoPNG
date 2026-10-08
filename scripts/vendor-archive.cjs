const fs = require('node:fs');
const path = require('node:path');

const source = path.dirname(require.resolve('libarchive.js/package.json'));
const destination = path.join(__dirname, '../vendor/libarchive');
fs.mkdirSync(destination, { recursive: true });
for (const [input, output] of [
    ['dist/libarchive.js', 'libarchive.mjs'],
    ['dist/worker-bundle.js', 'worker-bundle.js'],
    ['dist/libarchive.wasm', 'libarchive.wasm'],
    ['LICENSE', 'LICENSE']
]) {
    fs.copyFileSync(path.join(source, input), path.join(destination, output));
}
console.log('Copied libarchive.js 2.0.2 browser assets and license.');
