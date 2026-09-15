// Run: NODE_PATH=<directory containing pdf-lib> node tests/layout.cjs [sample.pdf] [output.pdf]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PDFLib = require('pdf-lib');
const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const start = source.indexOf('    const TR_LAYOUT_LANGS');
const end = source.indexOf('    function globeIconSvg', start);
const context = { window: { PDFLib }, PDFLib, Blob, console };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
(async () => {
    let bytes;
    if (process.argv[2]) bytes = fs.readFileSync(process.argv[2]);
    else {
        const pdf = await PDFLib.PDFDocument.create();
        pdf.addPage([1366, 1824]);
        bytes = await pdf.save();
    }
    const input = await PDFLib.PDFDocument.load(bytes);
    const original = input.getPages().map(() => ({ paragraphs: [], geo: [] }));
    const translations = input.getPages().map(() => ({ paragraphs: [] }));
    original[0] = { paragraphs: ['Original paragraph', 'Original small block'], geo: [
        { x0: 70, x1: 500, yTop: 1542, yBot: 1350, size: 22, leading: 26, n: 8, ocr: true },
        { x0: 70, x1: 100, yTop: 1330, yBot: 1320, size: 20, leading: 24, n: 1, ocr: true }
    ] };
    translations[0].paragraphs = ['La colección reúne casas seleccionadas con cuidado. Cada casa conserva su carácter y ofrece espacios para disfrutar.', 'Traducción extensa que no cabe. '.repeat(40)];
    const deferred = [];
    const blob = await context.trBuildPdfLayout(new Blob([bytes]), original, translations, false, null, deferred);
    assert.equal(deferred.length, 1);
    assert.equal(deferred[0].page, 1);
    assert.equal(deferred[0].text, translations[0].paragraphs[1].trim());
    const result = await PDFLib.PDFDocument.load(await blob.arrayBuffer());
    assert.equal(result.getPageCount(), input.getPageCount());
    input.getPages().forEach((page, i) => assert.deepEqual(result.getPage(i).getSize(), page.getSize()));
    // The selected format must not invoke the reformatted generator on error.
    const branch = source.slice(source.indexOf("} else if (fmt === 'pdf-layout')"), source.indexOf("} else if (fmt === 'pdf')", source.indexOf("} else if (fmt === 'pdf-layout')")));
    assert.ok(!/trBuildPdf\(/.test(branch));
    if (process.argv[3]) fs.writeFileSync(process.argv[3], Buffer.from(await blob.arrayBuffer()));
    console.log('PASS: fitting block translated, oversized block deferred, original page count and dimensions preserved, no reformat fallback');
})().catch(error => { console.error(error); process.exitCode = 1; });
