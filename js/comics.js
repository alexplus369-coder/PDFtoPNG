/* Comic conversion core: works in the browser and in the Node regression tests. */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ComicTools = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
    'use strict';

    const scriptUrl = root.document?.currentScript?.src;
    const archiveModuleUrl = scriptUrl ? new URL('../vendor/libarchive/libarchive.mjs', scriptUrl).href : null;
    const archiveWorkerUrl = scriptUrl ? new URL('../vendor/libarchive/worker-bundle.js', scriptUrl).href : null;
    const MIME_TYPES = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif'
    };
    const LIMITS = Object.freeze({ archiveBytes: 256 * 1024 * 1024, extractedBytes: 512 * 1024 * 1024, pages: 2000, pixels: 40000000 });
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    let archiveModulePromise;

    function abortIfNeeded(signal) {
        if (signal?.aborted) throw new DOMException('Conversión cancelada', 'AbortError');
    }

    function yieldToBrowser() {
        return root.document ? new Promise(resolve => setTimeout(resolve, 0)) : Promise.resolve();
    }

    function extension(name) {
        return String(name).split('.').pop().toLowerCase();
    }

    function isImagePath(name) {
        const parts = String(name).replace(/\\/g, '/').split('/');
        return parts.every(part => part && !part.startsWith('.') && part !== '__MACOSX') && Boolean(MIME_TYPES[extension(name)]);
    }

    function sortPages(pages) {
        return [...pages].sort((a, b) => collator.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    }

    function pageFilename(index, count, ext) {
        return `pagina-${String(index + 1).padStart(Math.max(3, String(count).length), '0')}.${ext === 'jpeg' ? 'jpg' : ext}`;
    }

    function checkPageCount(count) {
        if (!count) throw new Error('El cómic no contiene imágenes compatibles (PNG, JPEG, WebP, GIF, BMP o AVIF).');
        if (count > LIMITS.pages) throw new Error(`El cómic supera el límite de ${LIMITS.pages} páginas. Divídelo en varios archivos.`);
    }

    function checkSize(size) {
        if (size > LIMITS.extractedBytes) throw new Error('Las imágenes descomprimidas superan 512 MB. Divide el cómic en varios archivos.');
    }

    async function detectArchive(file) {
        const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
        if (bytes[0] === 0x50 && bytes[1] === 0x4b && [[3, 4], [5, 6], [7, 8]].some(([a, b]) => bytes[2] === a && bytes[3] === b)) return 'zip';
        if ([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07].every((value, i) => bytes[i] === value) &&
            (bytes[6] === 0 || (bytes[6] === 1 && bytes[7] === 0))) return 'rar';
        throw new Error('El archivo no contiene un ZIP/CBZ o RAR/CBR válido. Puede estar dañado o ser otra parte de un archivo dividido.');
    }

    function typedPage(name, blob) {
        return { name, blob: blob.slice(0, blob.size, MIME_TYPES[extension(name)]) };
    }

    async function extractZip(file, options) {
        const Zip = options.JSZip || root.JSZip;
        if (!Zip) throw new Error('No se pudo cargar el lector ZIP. Comprueba tu conexión y recarga la página.');
        let zip;
        try { zip = await Zip.loadAsync(await file.arrayBuffer()); }
        catch (error) {
            abortIfNeeded(options.signal);
            if (/encrypt|password/i.test(error.message)) throw new Error('Los cómics protegidos con contraseña no son compatibles. Descomprímelos primero.');
            throw new Error('No se pudo abrir el CBZ: el archivo está dañado o utiliza una compresión ZIP no compatible.');
        }
        abortIfNeeded(options.signal);
        // Use the original path too: JSZip sanitizes traversal segments in its public name.
        const entries = sortPages(Object.values(zip.files).filter(entry => !entry.dir && isImagePath(entry.unsafeOriginalName || entry.name)));
        checkPageCount(entries.length);
        checkSize(entries.reduce((sum, entry) => sum + (entry._data?.uncompressedSize || 0), 0));
        const pages = [];
        let bytes = 0;
        for (const entry of entries) {
            abortIfNeeded(options.signal);
            const blob = await entry.async('blob');
            bytes += blob.size;
            checkSize(bytes);
            pages.push(typedPage(entry.name, blob));
            options.onProgress?.(pages.length, entries.length, 'extract');
            await yieldToBrowser();
        }
        abortIfNeeded(options.signal);
        return pages;
    }

    async function loadArchiveModule() {
        if (root.location?.protocol === 'file:') throw new Error('Para abrir CBR, inicia un servidor local: python -m http.server 8000. Después abre http://localhost:8000.');
        if (!archiveModuleUrl) throw new Error('El lector RAR necesita un navegador con WebAssembly.');
        if (!archiveModulePromise) {
            archiveModulePromise = import(archiveModuleUrl).catch(() => {
                archiveModulePromise = null;
                throw new Error('No se pudo cargar el lector CBR. Actualiza todas las carpetas del proyecto, incluida vendor/libarchive.');
            });
        }
        return archiveModulePromise;
    }

    // libarchive's open promise can stay pending on an invalid file or failed worker.
    // Keep cancellation, errors and a finite timeout outside the library itself.
    function archiveOperation(task, signal, getWorker) {
        abortIfNeeded(signal);
        return new Promise((resolve, reject) => {
            const promise = task();
            const worker = getWorker();
            const finish = (callback, value) => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                worker?.removeEventListener('error', onError);
                worker?.removeEventListener('messageerror', onError);
                callback(value);
            };
            const onAbort = () => finish(reject, new DOMException('Conversión cancelada', 'AbortError'));
            const onError = () => finish(reject, new Error('No se pudo leer el CBR. Comprueba que el archivo esté completo y que vendor/libarchive esté disponible.'));
            const timer = setTimeout(() => finish(reject, new Error('El lector CBR no respondió a tiempo. Prueba con un archivo más pequeño o descomprímelo primero.')), 120000);
            signal?.addEventListener('abort', onAbort, { once: true });
            worker?.addEventListener('error', onError, { once: true });
            worker?.addEventListener('messageerror', onError, { once: true });
            Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
            if (signal?.aborted) onAbort();
        });
    }

    async function extractRar(file, options) {
        const { Archive } = options.Archive ? { Archive: options.Archive } : await loadArchiveModule();
        abortIfNeeded(options.signal);
        let worker, archive;
        const run = task => archiveOperation(task, options.signal, () => worker);
        try {
            Archive.init({ getWorker: () => {
                worker = options.getWorker ? options.getWorker() : new root.Worker(archiveWorkerUrl, { type: 'module' });
                return worker;
            } });
            archive = await run(() => Archive.open(file));
            if (await run(() => archive.hasEncryptedData())) throw new Error('Los cómics protegidos con contraseña no son compatibles. Descomprímelos primero.');
            const allEntries = await run(() => archive.getFilesArray());
            const entries = sortPages(allEntries.map(entry => ({ ...entry, name: `${entry.path || ''}${entry.file.name}` }))
                .filter(entry => isImagePath(entry.name)));
            checkPageCount(entries.length);
            checkSize(entries.reduce((sum, entry) => sum + entry.file.size, 0));
            const pages = [];
            let bytes = 0;
            for (const entry of entries) {
                abortIfNeeded(options.signal);
                const blob = await run(() => entry.file.extract());
                bytes += blob.size;
                checkSize(bytes);
                pages.push(typedPage(entry.name, blob));
                options.onProgress?.(pages.length, entries.length, 'extract');
            }
            abortIfNeeded(options.signal);
            return pages;
        } finally {
            await archive?.close();
            worker?.terminate();
        }
    }

    async function extractComic(file, options = {}) {
        abortIfNeeded(options.signal);
        if (!file || !/\.(cbz|cbr)$/i.test(file.name)) throw new Error('Selecciona un archivo .cbz o .cbr.');
        if (file.size > LIMITS.archiveBytes) throw new Error('El cómic supera 256 MB. Divide el archivo para reducir el uso de memoria.');
        const format = await detectArchive(file);
        abortIfNeeded(options.signal);
        return format === 'zip' ? extractZip(file, options) : extractRar(file, options);
    }

    async function convertImage(page, format, quality, signal) {
        abortIfNeeded(signal);
        if (format === 'original') return page.blob;
        if (format !== 'png' && format !== 'jpeg') throw new Error('Formato de imagen no válido.');
        const url = root.URL.createObjectURL(page.blob);
        const image = new root.Image();
        const canvas = root.document.createElement('canvas');
        try {
            await new Promise((resolve, reject) => {
                const cleanup = () => signal?.removeEventListener('abort', onAbort);
                const onAbort = () => { cleanup(); reject(new DOMException('Conversión cancelada', 'AbortError')); };
                image.onload = () => { cleanup(); resolve(); };
                image.onerror = () => { cleanup(); reject(new Error(`No se pudo leer la imagen ${page.name}.`)); };
                signal?.addEventListener('abort', onAbort, { once: true });
                image.src = url;
                if (signal?.aborted) onAbort();
            });
            abortIfNeeded(signal);
            if (image.naturalWidth * image.naturalHeight > LIMITS.pixels) throw new Error(`La imagen ${page.name} supera 40 megapíxeles. Reduce su resolución antes de convertirla.`);
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d');
            if (format === 'jpeg') {
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            context.drawImage(image, 0, 0);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, MIME_TYPES[format], quality));
            if (!blob) throw new Error(`No se pudo convertir la imagen ${page.name}.`);
            abortIfNeeded(signal);
            return blob;
        } finally {
            image.onload = image.onerror = null;
            image.src = '';
            root.URL.revokeObjectURL(url);
            canvas.width = canvas.height = 0;
        }
    }

    function pageLayout(width, height, pageSize = 'original', orientation = 'auto') {
        if (!(width > 0 && height > 0)) throw new Error('La imagen tiene dimensiones no válidas.');
        let pageWidth, pageHeight, margin;
        if (pageSize === 'original') {
            const scale = Math.min(0.75, 14400 / Math.max(width, height));
            pageWidth = width * scale;
            pageHeight = height * scale;
            margin = 0;
        } else {
            if (pageSize === 'a4') [pageWidth, pageHeight] = [595.2756, 841.8898];
            else if (pageSize === 'letter') [pageWidth, pageHeight] = [612, 792];
            else throw new Error('Tamaño de página no válido.');
            if (orientation === 'landscape' || (orientation === 'auto' && width > height)) [pageWidth, pageHeight] = [pageHeight, pageWidth];
            margin = 18;
        }
        const scale = Math.min((pageWidth - 2 * margin) / width, (pageHeight - 2 * margin) / height);
        const drawWidth = width * scale, drawHeight = height * scale;
        return { pageWidth, pageHeight, width: drawWidth, height: drawHeight, x: (pageWidth - drawWidth) / 2, y: (pageHeight - drawHeight) / 2 };
    }

    async function createPdf(pages, options = {}) {
        checkPageCount(pages.length);
        const PDFLib = options.PDFLib || root.PDFLib;
        if (!PDFLib) throw new Error('No se pudo cargar el generador PDF. Comprueba tu conexión y recarga la página.');
        const pdf = await PDFLib.PDFDocument.create();
        pdf.setTitle(options.title || 'Cómic');
        const convert = options.convertImage || convertImage;
        for (let index = 0; index < pages.length; index++) {
            abortIfNeeded(options.signal);
            const item = pages[index];
            const originalType = MIME_TYPES[extension(item.name)];
            const requestedFormat = options.imageFormat || 'original';
            const format = requestedFormat === 'original' && !['image/png', 'image/jpeg'].includes(originalType) ? 'png' : requestedFormat;
            const blob = await convert(item, format, options.quality ?? 0.9, options.signal);
            const bytes = await blob.arrayBuffer();
            let image;
            try {
                image = blob.type === 'image/jpeg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
            } catch {
                throw new Error(`No se pudo añadir la imagen ${item.name} al PDF. Comprueba que no esté dañada.`);
            }
            const layout = pageLayout(image.width, image.height, options.pageSize, options.orientation);
            const page = pdf.addPage([layout.pageWidth, layout.pageHeight]);
            page.drawImage(image, layout);
            options.onProgress?.(index + 1, pages.length, 'convert');
            await yieldToBrowser();
        }
        abortIfNeeded(options.signal);
        const bytes = await pdf.save();
        abortIfNeeded(options.signal);
        return new Blob([bytes], { type: 'application/pdf' });
    }

    async function createImagesZip(pages, options = {}) {
        checkPageCount(pages.length);
        const Zip = options.JSZip || root.JSZip;
        if (!Zip) throw new Error('No se pudo cargar el generador ZIP. Comprueba tu conexión y recarga la página.');
        const zip = new Zip();
        const format = options.imageFormat || 'original';
        const convert = options.convertImage || convertImage;
        for (let index = 0; index < pages.length; index++) {
            abortIfNeeded(options.signal);
            const blob = await convert(pages[index], format, options.quality ?? 0.9, options.signal);
            const ext = format === 'original' ? extension(pages[index].name) : format;
            zip.file(`imagenes/${pageFilename(index, pages.length, ext)}`, await blob.arrayBuffer());
            options.onProgress?.(index + 1, pages.length, 'convert');
            await yieldToBrowser();
        }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, () => abortIfNeeded(options.signal));
        abortIfNeeded(options.signal);
        return blob;
    }

    return { LIMITS, isImagePath, sortPages, pageFilename, detectArchive, extractComic, convertImage, pageLayout, createPdf, createImagesZip };
});
