const assert = require('node:assert/strict');
const JSZip = require('jszip');
const PDFLib = require('pdf-lib');
const tools = require('../js/comics.js');
const { entries, rar4, rar5 } = require('./comic-fixtures.cjs');

(async () => {
    const source = entries();
    const zip = new JSZip();
    source.forEach(entry => zip.file(entry.name, entry.bytes));
    zip.file('hidden/.page.png', source[0].bytes);
    zip.file('../outside.png', source[0].bytes);
    const zipBytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const comic = new File([zipBytes], 'Book.CBZ');
    const pages = await tools.extractComic(comic, { JSZip });
    assert.deepEqual(pages.map(page => page.name), ['pages/1.PNG', 'pages/2.png', 'pages/10.png']);
    assert.equal(pages[0].blob.type, 'image/png');
    assert.deepEqual(Buffer.from(await pages[0].blob.arrayBuffer()), source[2].bytes);
    assert.deepEqual(tools.sortPages([{ name: 'Chapter 10/1.jpg' }, { name: 'Chapter 2/1.jpg' }]).map(page => page.name), ['Chapter 2/1.jpg', 'Chapter 10/1.jpg']);
    assert.equal(await tools.detectArchive(new File([rar4()], 'book.cbr')), 'rar');
    assert.equal(await tools.detectArchive(new File([rar5()], 'book.cbr')), 'rar');
    assert.equal((await tools.extractComic(new File([zipBytes], 'misnamed.cbr'), { JSZip })).length, 3);
    assert.equal(tools.pageFilename(1000, 1001, 'jpeg'), 'pagina-1001.jpg');

    const outputZip = await tools.createImagesZip(pages, { JSZip });
    const resultZip = await JSZip.loadAsync(await outputZip.arrayBuffer());
    const imageNames = Object.keys(resultZip.files).filter(name => !resultZip.files[name].dir);
    assert.deepEqual(imageNames, ['imagenes/pagina-001.png', 'imagenes/pagina-002.png', 'imagenes/pagina-003.png']);
    for (let i = 0; i < pages.length; i++) {
        assert.deepEqual(await resultZip.file(imageNames[i]).async('nodebuffer'), Buffer.from(await pages[i].blob.arrayBuffer()));
    }

    const original = await PDFLib.PDFDocument.load(await (await tools.createPdf(pages, { PDFLib })).arrayBuffer());
    assert.equal(original.getPageCount(), 3);
    assert.deepEqual(original.getPages().map(page => page.getSize()), [{ width: 90, height: 135 }, { width: 90, height: 135 }, { width: 180, height: 90 }]);
    const a4 = await PDFLib.PDFDocument.load(await (await tools.createPdf(pages, { PDFLib, pageSize: 'a4', orientation: 'auto' })).arrayBuffer());
    assert.deepEqual(a4.getPage(2).getSize(), { width: 841.8898, height: 595.2756 });
    const letter = await PDFLib.PDFDocument.load(await (await tools.createPdf(pages, { PDFLib, pageSize: 'letter', orientation: 'portrait' })).arrayBuffer());
    assert.deepEqual(letter.getPage(2).getSize(), { width: 612, height: 792 });
    const layout = tools.pageLayout(240, 120, 'letter', 'portrait');
    assert.equal(layout.width / layout.height, 2);
    assert.ok(layout.x >= 18 && layout.y >= 18 && layout.x + layout.width <= 594 && layout.y + layout.height <= 774);

    await assert.rejects(tools.extractComic(new File(['not a comic'], 'invalid.cbz'), { JSZip }), /no contiene un ZIP/);
    await assert.rejects(tools.extractComic(new File([zipBytes], 'book.pdf'), { JSZip }), /\.cbz o \.cbr/);
    await assert.rejects(tools.extractComic({ name: 'large.cbz', size: tools.LIMITS.archiveBytes + 1 }), /256 MB/);
    const empty = await new JSZip().generateAsync({ type: 'nodebuffer' });
    await assert.rejects(tools.extractComic(new File([empty], 'empty.cbz'), { JSZip }), /no contiene imágenes/);
    const encrypted = Buffer.from(zipBytes);
    for (let i = 0; i < encrypted.length - 10; i++) {
        if (encrypted.readUInt32LE(i) === 0x04034b50) encrypted.writeUInt16LE(encrypted.readUInt16LE(i + 6) | 1, i + 6);
        if (encrypted.readUInt32LE(i) === 0x02014b50) encrypted.writeUInt16LE(encrypted.readUInt16LE(i + 8) | 1, i + 8);
    }
    await assert.rejects(tools.extractComic(new File([encrypted], 'locked.cbz'), { JSZip }), /contraseña/);
    const cancellation = new AbortController();
    await assert.rejects(tools.extractComic(comic, { JSZip, signal: cancellation.signal, onProgress: () => cancellation.abort() }), { name: 'AbortError' });
    await assert.rejects(tools.createPdf(pages, { PDFLib, signal: cancellation.signal }), { name: 'AbortError' });

    let closed = false, terminated = false;
    const fakeWorker = new EventTarget();
    fakeWorker.terminate = () => { terminated = true; };
    const fakeArchive = {
        hasEncryptedData: async () => true,
        close: async () => { closed = true; }
    };
    const Archive = {
        init(options) { this.options = options; },
        async open() { this.options.getWorker(); return fakeArchive; }
    };
    await assert.rejects(tools.extractComic(new File([rar4()], 'locked.cbr'), { Archive, getWorker: () => fakeWorker }), /contraseña/);
    assert.ok(closed && terminated, 'RAR workers are closed even when extraction fails');
    terminated = false;
    Archive.open = function () {
        this.options.getWorker();
        setTimeout(() => fakeWorker.dispatchEvent(new Event('error')), 0);
        return new Promise(() => {});
    };
    await assert.rejects(tools.extractComic(new File([rar4()], 'failed.cbr'), { Archive, getWorker: () => fakeWorker }), /No se pudo leer el CBR/);
    assert.ok(terminated, 'A failed worker must not leave the UI waiting indefinitely');
    console.log('PASS: CBZ extraction, natural order, hidden-file filtering, exact image bytes, real PDF/ZIP output, per-page dimensions, encryption, corrupt inputs, cancellation and RAR worker cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
