const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const JSZip = require('jszip');
const PDFLib = require('pdf-lib');
const { entries, rar4, rar5 } = require('./comic-fixtures.cjs');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
const server = http.createServer(async (request, response) => {
    try {
        const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
        if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
        const data = await fs.readFile(file);
        response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
        response.end(data);
    } catch { response.writeHead(404); response.end(); }
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
        const context = await browser.newContext({ acceptDownloads: true });
        // Real ZIP, PDF and download libraries; unrelated CDN tools are isolated.
        // CBR modules, Web Worker and WASM are fetched from the actual local site.
        await context.route('https://**/*', async route => {
            const source = route.request().url();
            let body = '';
            if (source.includes('jszip.min.js')) body = await fs.readFile(path.join(root, 'node_modules/jszip/dist/jszip.min.js'), 'utf8');
            else if (source.includes('pdf-lib.min.js')) body = await fs.readFile(path.join(root, 'node_modules/pdf-lib/dist/pdf-lib.min.js'), 'utf8');
            else if (source.includes('FileSaver.min.js')) body = await fs.readFile(path.join(root, 'node_modules/file-saver/dist/FileSaver.min.js'), 'utf8');
            else if (source.includes('pdf.min.js')) body = 'window.pdfjsLib = { GlobalWorkerOptions: {} };';
            await route.fulfill({ status: 200, contentType: source.includes('fonts.googleapis.com') ? 'text/css' : 'text/javascript', body });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.setDefaultTimeout(20000);
        await page.goto(url);
        await page.locator('[data-mode="comics"]').click();
        assert.equal(await page.locator('#pdf2imgPanel').isVisible(), false);
        assert.equal(await page.locator('#comicsPanel').isVisible(), true);

        const zip = new JSZip();
        const source = entries();
        source.forEach(entry => zip.file(entry.name, entry.bytes));
        const zipBytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        async function upload(name, buffer) {
            await page.locator('#comicFileInput').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
            await page.waitForFunction(() => document.querySelector('#comicOptions').hidden === false && document.querySelector('#comicsPanel').getAttribute('aria-busy') === 'false');
            assert.match(await page.locator('#comicFileMeta').textContent(), /3 páginas/);
        }
        async function convert() {
            await page.locator('#comicConvert').click();
            await page.waitForFunction(() => document.querySelector('#comicResults').hidden === false && document.querySelector('#comicsPanel').getAttribute('aria-busy') === 'false');
            assert.deepEqual(await page.locator('.comic-page-name').allTextContents(), ['pages/1.PNG', 'pages/2.png', 'pages/10.png']);
        }
        async function download() {
            const ready = page.waitForEvent('download');
            await page.locator('#comicDownload').click();
            const file = await ready;
            assert.equal(await file.failure(), null);
            return { bytes: await fs.readFile(await file.path()), name: file.suggestedFilename() };
        }
        async function checkPdf(expectedSize) {
            await convert();
            const file = await download();
            assert.match(file.name, /\.pdf$/);
            const pdf = await PDFLib.PDFDocument.load(file.bytes);
            assert.equal(pdf.getPageCount(), 3);
            assert.deepEqual(pdf.getPage(0).getSize(), expectedSize);
        }

        await upload('sample.cbz', zipBytes);
        await checkPdf({ width: 90, height: 135 });
        await page.locator('#comicPageSize').selectOption('a4');
        await checkPdf({ width: 595.2756, height: 841.8898 });
        await page.locator('#comicPageSize').selectOption('letter');
        await checkPdf({ width: 612, height: 792 });
        await page.locator('#comicOutput').selectOption('images');
        await convert();
        const originalZip = await JSZip.loadAsync((await download()).bytes);
        assert.deepEqual(await originalZip.file('imagenes/pagina-001.png').async('nodebuffer'), source[2].bytes);
        const individualReady = page.waitForEvent('download');
        await page.locator('#comicPages .page-dl').first().click();
        const individual = await individualReady;
        assert.equal(individual.suggestedFilename(), 'pagina-001.png');
        assert.deepEqual(await fs.readFile(await individual.path()), source[2].bytes);
        await page.locator('#comicImageFormat').selectOption('jpeg');
        await convert();
        const jpegZip = await JSZip.loadAsync((await download()).bytes);
        const jpeg = await jpegZip.file('imagenes/pagina-001.jpg').async('nodebuffer');
        assert.equal(jpeg.readUInt16BE(0), 0xffd8);
        const jpegImage = await (await PDFLib.PDFDocument.create()).embedJpg(Uint8Array.from(jpeg));
        assert.deepEqual([jpegImage.width, jpegImage.height], [120, 180]);
        await page.locator('#comicImageFormat').selectOption('png');
        await convert();
        const pngZip = await JSZip.loadAsync((await download()).bytes);
        const png = await pngZip.file('imagenes/pagina-001.png').async('nodebuffer');
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

        await page.locator('#comicOutput').selectOption('pdf');
        await page.locator('#comicImageFormat').selectOption('jpeg');
        await checkPdf({ width: 612, height: 792 });
        await page.locator('#comicImageFormat').selectOption('original');
        await page.locator('#comicPageSize').selectOption('original');
        for (const [name, bytes] of [['sample-rar4.cbr', rar4()], ['sample-rar5.cbr', rar5()]]) {
            await upload(name, bytes);
            await checkPdf({ width: 90, height: 135 });
            console.log(`PASS browser: ${name} decoded by the real RAR worker and downloaded as a 3-page PDF`);
        }
        // Check cancellation while several pages are being processed, then retry.
        const aborted = await page.evaluate(async () => {
            const zip = new JSZip();
            for (let i = 0; i < 30; i++) zip.file(`${i}.png`, await (await fetch(document.querySelector('#comicPages img').src)).arrayBuffer());
            const file = new File([await zip.generateAsync({ type: 'blob' })], 'cancel.cbz');
            const controller = new AbortController();
            try {
                await ComicTools.extractComic(file, { signal: controller.signal, onProgress: () => controller.abort() });
                return false;
            } catch (error) { return error.name === 'AbortError'; }
        });
        assert.ok(aborted);
        await page.evaluate(() => {
            const createPdf = ComicTools.createPdf;
            ComicTools.createPdf = async (pages, options) => {
                // Give the click event time to reach the real conversion's signal.
                await new Promise(resolve => setTimeout(resolve, 1000));
                return createPdf(pages, options);
            };
        });
        await page.locator('#comicConvert').click();
        await page.locator('#comicCancel').click();
        await page.waitForFunction(() => document.querySelector('#comicsPanel').getAttribute('aria-busy') === 'false');
        assert.match(await page.locator('#comicStatus').textContent(), /cancelada/);
        await checkPdf({ width: 90, height: 135 });

        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('[data-mode="pdf2img"]').click();
        assert.equal(await page.locator('#comicsPanel').isVisible(), false);
        await page.locator('[data-mode="comics"]').click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
        await page.screenshot({ path: path.join(root, 'test-results/comics-mobile.png'), fullPage: true, animations: 'disabled' });
        await page.setViewportSize({ width: 1280, height: 960 });
        await page.screenshot({ path: path.join(root, 'test-results/comics-desktop.png'), fullPage: true, animations: 'disabled' });
        await page.locator('#comicFileInput').setInputFiles({ name: 'broken.cbz', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid') });
        await page.waitForFunction(() => document.querySelector('#comicsPanel').getAttribute('aria-busy') === 'false');
        assert.match(await page.locator('#comicStatus').textContent(), /no contiene un ZIP/);
        assert.equal(await page.locator('#comicResults').isVisible(), false);
        await upload('sample.cbz', zipBytes);
        await checkPdf({ width: 90, height: 135 });
        assert.deepEqual(errors, []);
        console.log('PASS browser: CBZ and RAR4/RAR5, original/A4/Letter PDF, original/PNG/JPEG ZIP, individual downloads, cancellation/retry, corrupt-file recovery and mobile layout');
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
