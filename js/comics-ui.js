(() => {
    'use strict';
    const panel = document.querySelector('#comicsPanel');
    if (!panel) return;
    const $ = id => panel.querySelector(`#${id}`);
    const tools = window.ComicTools;
    const input = $('comicFileInput');
    const dropZone = $('comicDropZone');
    const optionsSection = $('comicOptions');
    const resultsSection = $('comicResults');
    const progressSection = $('comicProgress');
    const status = $('comicStatus');
    const output = $('comicOutput');
    const format = $('comicImageFormat');
    const quality = $('comicQuality');
    let file = null, pages = [], result = null, controller = null;
    const previewUrls = [];

    function report(message, isError = false) {
        status.textContent = message;
        status.classList.toggle('comic-error', isError);
    }

    function clearResult() {
        result = null;
        resultsSection.hidden = true;
        $('comicPages').replaceChildren();
        previewUrls.forEach(url => URL.revokeObjectURL(url));
        previewUrls.length = 0;
    }

    function setBusy(busy) {
        panel.setAttribute('aria-busy', String(busy));
        input.disabled = busy;
        dropZone.disabled = busy;
        optionsSection.querySelectorAll('button, select, input').forEach(element => { element.disabled = busy; });
        $('comicCancel').disabled = !busy;
        progressSection.hidden = !busy;
        if (!busy) syncOptions();
    }

    function syncOptions() {
        const isPdf = output.value === 'pdf';
        $('comicPdfSettings').hidden = !isPdf;
        quality.disabled = format.value !== 'jpeg';
        $('comicQualityValue').textContent = format.value === 'jpeg' ? `${quality.value}%` : 'Sin pérdida';
        $('comicOrientation').disabled = $('comicPageSize').value === 'original';
        $('comicConvert').textContent = isPdf ? 'Generar PDF' : 'Generar ZIP de imágenes';
    }

    function progress(done, total, stage) {
        const percent = Math.round((done / total) * 100);
        $('comicProgressFill').style.width = `${percent}%`;
        $('comicProgressPercent').textContent = `${percent}%`;
        $('comicProgressTitle').textContent = `${stage === 'extract' ? 'Extrayendo' : 'Convirtiendo'} página ${done} de ${total}…`;
    }

    function showPages() {
        const fragment = document.createDocumentFragment();
        pages.forEach((page, index) => {
            const card = document.createElement('div');
            card.className = 'page-card';
            const image = document.createElement('img');
            const url = URL.createObjectURL(page.blob);
            previewUrls.push(url);
            image.src = url;
            image.className = 'page-thumb';
            image.alt = `Página ${index + 1}`;
            image.loading = 'lazy';
            const name = document.createElement('p');
            name.className = 'comic-page-name';
            name.textContent = page.name;
            const footer = document.createElement('div');
            footer.className = 'page-footer';
            const number = document.createElement('span');
            number.className = 'page-num';
            number.textContent = `Página ${index + 1}`;
            const download = document.createElement('button');
            download.className = 'page-dl';
            download.type = 'button';
            download.textContent = 'Original';
            download.setAttribute('aria-label', `Descargar imagen original de la página ${index + 1}`);
            download.addEventListener('click', () => saveAs(page.blob, tools.pageFilename(index, pages.length, page.name.split('.').pop().toLowerCase())));
            footer.append(number, download);
            card.append(image, name, footer);
            fragment.append(card);
        });
        $('comicPages').append(fragment);
    }

    async function selectFile(nextFile) {
        if (controller || !nextFile) return;
        if (!/\.(cbz|cbr)$/i.test(nextFile.name)) {
            report('Selecciona un archivo .cbz o .cbr.', true);
            input.value = '';
            return;
        }
        clearResult();
        file = null;
        pages = [];
        optionsSection.hidden = true;
        controller = new AbortController();
        setBusy(true);
        report('Leyendo el cómic…');
        $('comicProgressFill').style.width = '0%';
        $('comicProgressPercent').textContent = '0%';
        $('comicProgressTitle').textContent = 'Abriendo el archivo…';
        try {
            const extracted = await tools.extractComic(nextFile, { signal: controller.signal, onProgress: progress });
            file = nextFile;
            pages = extracted;
            $('comicFileName').textContent = file.name;
            $('comicFileMeta').textContent = `${pages.length} páginas · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
            optionsSection.hidden = false;
            report(`${pages.length} páginas listas, ordenadas por nombre (1, 2, 10).`);
        } catch (error) {
            report(error.name === 'AbortError' ? 'Lectura cancelada. Puedes elegir otro cómic.' : error.message, error.name !== 'AbortError');
        } finally {
            controller = null;
            input.value = '';
            setBusy(false);
        }
    }

    async function convert() {
        if (!file || !pages.length || controller) return;
        clearResult();
        controller = new AbortController();
        setBusy(true);
        report('Preparando la conversión…');
        const selectedOutput = output.value;
        const options = {
            signal: controller.signal, onProgress: progress, title: file.name.replace(/\.(cbr|cbz)$/i, ''),
            imageFormat: format.value, quality: Number(quality.value) / 100,
            pageSize: $('comicPageSize').value, orientation: $('comicOrientation').value
        };
        progress(0, pages.length, 'convert');
        try {
            const blob = await (selectedOutput === 'pdf' ? tools.createPdf(pages, options) : tools.createImagesZip(pages, options));
            result = { blob, name: `${options.title}${selectedOutput === 'pdf' ? '.pdf' : '-imagenes.zip'}` };
            $('comicResultMeta').textContent = `${pages.length} páginas · ${(blob.size / 1024 / 1024).toFixed(2)} MB · ${result.name}`;
            $('comicDownload').textContent = selectedOutput === 'pdf' ? 'Descargar PDF' : 'Descargar ZIP';
            showPages();
            resultsSection.hidden = false;
            report('Conversión lista. Las imágenes originales también están disponibles por separado.');
        } catch (error) {
            report(error.name === 'AbortError' ? 'Conversión cancelada. Puedes cambiar las opciones y reintentar.' : error.message, error.name !== 'AbortError');
        } finally {
            controller = null;
            setBusy(false);
        }
    }

    dropZone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => selectFile(input.files[0]));
    dropZone.addEventListener('dragover', event => {
        event.preventDefault();
        if (!controller) dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', event => {
        event.preventDefault();
        dropZone.classList.remove('dragover');
        if (!controller) selectFile(event.dataTransfer.files[0]);
    });
    $('comicConvert').addEventListener('click', convert);
    $('comicCancel').addEventListener('click', () => {
        controller?.abort();
        $('comicCancel').disabled = true;
        report('Cancelando…');
    });
    $('comicReset').addEventListener('click', () => {
        if (controller) return;
        clearResult();
        file = null;
        pages = [];
        input.value = '';
        optionsSection.hidden = true;
        report('');
    });
    $('comicDownload').addEventListener('click', () => {
        if (result) saveAs(result.blob, result.name);
    });
    output.addEventListener('change', syncOptions);
    format.addEventListener('change', syncOptions);
    $('comicPageSize').addEventListener('change', syncOptions);
    quality.addEventListener('input', syncOptions);
    window.addEventListener('pagehide', () => {
        controller?.abort();
        clearResult();
    });
    syncOptions();
})();
