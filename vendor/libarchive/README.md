# libarchive.js browser assets

These files are copied from the published npm package `libarchive.js@2.0.2`.
Source: https://github.com/nika-begiashvili/libarchivejs

- `libarchive.mjs`: browser ES module, renamed from `dist/libarchive.js`.
- `worker-bundle.js`: browser module worker.
- `libarchive.wasm`: WebAssembly archive reader.
- `LICENSE`: upstream package license. Bundles retain their license notices.

Keep all these files together when deploying the static site. They are loaded
only when a real RAR/CBR file is selected. Serving the worker and WASM from the
same origin avoids cross-origin Worker restrictions and CDN path changes.

To regenerate from the locked package, run `npm ci` and `npm run vendor:archive`.
