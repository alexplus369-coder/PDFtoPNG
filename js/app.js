(() => {
    // ===================== UTILIDADES =====================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const toastEl = $('#toast');

    function showToast(msg, type = '') {
        toastEl.textContent = msg;
        toastEl.className = 'toast' + (type ? ' ' + type : '');
        requestAnimationFrame(() => toastEl.classList.add('show'));
        setTimeout(() => toastEl.classList.remove('show'), 3200);
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // ===================== CAMBIO DE MODO =====================
    const modeBtns = $$('.mode-btn');

    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const clickedBtn = e.currentTarget;
            const targetMode = clickedBtn.dataset.mode;

            // 1. Quitar clase active a todos los botones y dársela al presionado
            modeBtns.forEach(b => b.classList.remove('active'));
            clickedBtn.classList.add('active');

            // 2. Ocultar todos los paneles principales dentro de <main>
            const mainPanels = document.querySelectorAll('main > div');
            mainPanels.forEach(panel => {
                panel.style.display = 'none';
            });

            // 3. Determinar el ID exacto del panel a mostrar
            let targetPanelId = '';
            if (targetMode === 'pdf2img') targetPanelId = 'pdf2imgPanel';
            else if (targetMode === 'img2pdf') targetPanelId = 'img2pdfPanel';
            else if (targetMode === 'mergepdf') targetPanelId = 'mergePdfPanel';
            else if (targetMode === 'splitpdf') targetPanelId = 'splitPdfPanel';
            else if (targetMode === 'renamefiles') targetPanelId = 'renameFilesPanel';
            else if (targetMode === 'word2pdf') targetPanelId = 'word2pdfPanel';
            else if (targetMode === 'pdf2word') targetPanelId = 'pdf2wordPanel';

            // 4. Mostrar el panel correspondiente si existe
            const activePanel = document.getElementById(targetPanelId);
            if (activePanel) {
                activePanel.style.display = 'block';
            }
        });
    });

    // ============================================================
    // ===================== MODO PDF → IMAGEN =====================
    // ============================================================
    const dropZonePdf = $('#dropZonePdf');
    const fileInputPdf = $('#fileInputPdf');
    const uploadSectionPdf = $('#uploadSectionPdf');
    const optionsSectionPdf = $('#optionsSectionPdf');
    const progressSectionPdf = $('#progressSectionPdf');
    const resultsSectionPdf = $('#resultsSectionPdf');
    const fileNamePdf = $('#fileNamePdf');
    const filePagesPdf = $('#filePagesPdf');
    const removeFilePdf = $('#removeFilePdf');
    const formatSelectorPdf = $('#formatSelectorPdf');
    const qualityRangePdf = $('#qualityRangePdf');
    const qualityValuePdf = $('#qualityValuePdf');
    const scaleSelectPdf = $('#scaleSelectPdf');
    const convertBtnPdf = $('#convertBtnPdf');
    const progressTitlePdf = $('#progressTitlePdf');
    const progressPercentPdf = $('#progressPercentPdf');
    const progressFillPdf = $('#progressFillPdf');
    const cancelBtnPdf = $('#cancelBtnPdf');
    const pagesListPdf = $('#pagesListPdf');
    const resultsMetaPdf = $('#resultsMetaPdf');
    const downloadZipBtnPdf = $('#downloadZipBtnPdf');

    let currentPdf = null;
    let pdfDocument = null;
    let isConvertingPdf = false;
    let shouldCancelPdf = false;
    let convertedPagesPdf = [];

    if (dropZonePdf && fileInputPdf) {
        dropZonePdf.addEventListener('click', () => fileInputPdf.click());
        fileInputPdf.addEventListener('change', (e) => {
            if (e.target.files[0]) handlePdfFile(e.target.files[0]);
        });

        dropZonePdf.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZonePdf.classList.add('dragover');
        });
        dropZonePdf.addEventListener('dragleave', () => dropZonePdf.classList.remove('dragover'));
        dropZonePdf.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZonePdf.classList.remove('dragover');
            const f = e.dataTransfer.files[0];
            if (f && f.type === 'application/pdf') handlePdfFile(f);
            else showToast('Solo se permiten archivos PDF', 'error');
        });
    }

    if (formatSelectorPdf) {
        formatSelectorPdf.querySelectorAll('.segment').forEach(btn => {
            btn.addEventListener('click', () => {
                formatSelectorPdf.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const isJpeg = btn.dataset.value === 'jpeg';
                qualityRangePdf.disabled = !isJpeg;
                qualityValuePdf.textContent = isJpeg ? qualityRangePdf.value + '%' : '100%';
            });
        });
    }

    if (qualityRangePdf) {
        qualityRangePdf.addEventListener('input', (e) => {
            qualityValuePdf.textContent = e.target.value + '%';
        });
    }

    if (removeFilePdf) removeFilePdf.addEventListener('click', resetPdfMode);
    if (convertBtnPdf) convertBtnPdf.addEventListener('click', startPdfConversion);
    if (cancelBtnPdf) cancelBtnPdf.addEventListener('click', () => {
        shouldCancelPdf = true;
        showToast('Cancelando...');
    });
    if (downloadZipBtnPdf) downloadZipBtnPdf.addEventListener('click', downloadPdfZip);

    async function handlePdfFile(file) {
        if (file.type !== 'application/pdf') {
            showToast('El archivo no es un PDF válido', 'error');
            return;
        }
        currentPdf = file;
        fileNamePdf.textContent = file.name;

        try {
            const arrayBuffer = await file.arrayBuffer();
            pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            filePagesPdf.textContent = `${pdfDocument.numPages} página${pdfDocument.numPages !== 1 ? 's' : ''}`;

            if (pdfDocument.numPages > 100) {
                showToast('PDF muy grande. La conversión puede tardar.', 'warning');
            }

            uploadSectionPdf.style.display = 'none';
            optionsSectionPdf.style.display = 'block';
            resultsSectionPdf.style.display = 'none';
            progressSectionPdf.style.display = 'none';
        } catch (err) {
            showToast('No se pudo leer el PDF', 'error');
        }
    }

    async function startPdfConversion() {
        if (!pdfDocument || isConvertingPdf) return;

        const format = formatSelectorPdf.querySelector('.segment.active').dataset.value;
        const quality = parseInt(qualityRangePdf.value) / 100;
        const scale = parseFloat(scaleSelectPdf.value);
        const total = pdfDocument.numPages;

        isConvertingPdf = true;
        shouldCancelPdf = false;
        convertedPagesPdf = [];

        optionsSectionPdf.style.display = 'none';
        progressSectionPdf.style.display = 'block';
        resultsSectionPdf.style.display = 'none';
        setPdfProgress(0, `Preparando ${total} páginas...`);

        const btnLabel = convertBtnPdf.querySelector('.btn-label');
        const btnSpinner = convertBtnPdf.querySelector('.btn-spinner');
        btnLabel.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
        convertBtnPdf.disabled = true;

        const zip = new JSZip();
        const folder = zip.folder("imagenes");

        try {
            for (let i = 1; i <= total; i++) {
                if (shouldCancelPdf) throw new Error('Cancelado');

                setPdfProgress(((i - 1) / total) * 100, `Convirtiendo página ${i} de ${total}...`);

                const page = await pdfDocument.getPage(i);
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                if (format === 'jpeg') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }

                await page.render({ canvasContext: ctx, viewport }).promise;

                const blob = await new Promise((resolve) => {
                    canvas.toBlob(resolve, `image/${format}`, format === 'jpeg' ? quality : undefined);
                });

                const url = URL.createObjectURL(blob);
                convertedPagesPdf.push({ blob, url, pageNum: i, format });

                const ext = format === 'jpeg' ? 'jpg' : 'png';
                folder.file(`pagina-${String(i).padStart(3, '0')}.${ext}`, blob);

                page.cleanup();
                canvas.width = 0;
                canvas.height = 0;
            }

            if (shouldCancelPdf) throw new Error('Cancelado');

            setPdfProgress(100, 'Completado');
            showPdfResults(zip);

        } catch (err) {
            if (err.message === 'Cancelado') {
                showToast('Conversión cancelada', 'error');
            } else {
                showToast('Error: ' + err.message, 'error');
            }
            optionsSectionPdf.style.display = 'block';
            progressSectionPdf.style.display = 'none';
        } finally {
            isConvertingPdf = false;
            btnLabel.style.display = 'inline';
            btnSpinner.style.display = 'none';
            convertBtnPdf.disabled = false;
        }
    }

    function setPdfProgress(percent, title) {
        progressFillPdf.style.width = percent + '%';
        progressPercentPdf.textContent = Math.round(percent) + '%';
        if (title) progressTitlePdf.textContent = title;
    }

    function showPdfResults(zip) {
        progressSectionPdf.style.display = 'none';
        resultsSectionPdf.style.display = 'block';
        resultsMetaPdf.textContent = `${convertedPagesPdf.length} página${convertedPagesPdf.length !== 1 ? 's' : ''} convertida${convertedPagesPdf.length !== 1 ? 's' : ''}`;

        pagesListPdf.innerHTML = '';
        convertedPagesPdf.forEach((page, idx) => {
            const card = document.createElement('div');
            card.className = 'page-card';
            card.innerHTML = `
                <img src="${page.url}" alt="Página ${page.pageNum}" class="page-thumb" loading="lazy">
                <div class="page-footer">
                    <span class="page-num">Página ${page.pageNum}</span>
                    <button class="page-dl" data-idx="${idx}">Descargar</button>
                </div>
            `;
            pagesListPdf.appendChild(card);
        });

        pagesListPdf._zip = zip;

        pagesListPdf.querySelectorAll('.page-dl').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = convertedPagesPdf[parseInt(btn.dataset.idx)];
                const ext = p.format === 'jpeg' ? 'jpg' : 'png';
                saveAs(p.blob, `pagina-${String(p.pageNum).padStart(3, '0')}.${ext}`);
            });
        });
    }

    async function downloadPdfZip() {
        const zip = pagesListPdf._zip;
        if (!zip) return;

        downloadZipBtnPdf.disabled = true;
        const originalHtml = downloadZipBtnPdf.innerHTML;
        downloadZipBtnPdf.innerHTML = `<svg class="spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/></svg> Generando...`;

        try {
            const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            saveAs(content, 'pdf-imagenes.zip');
            showToast('ZIP descargado', 'success');
        } catch (e) {
            showToast('Error al generar ZIP', 'error');
        } finally {
            downloadZipBtnPdf.disabled = false;
            downloadZipBtnPdf.innerHTML = originalHtml;
        }
    }

    function resetPdfMode() {
        currentPdf = null;
        pdfDocument = null;
        isConvertingPdf = false;
        shouldCancelPdf = false;
        convertedPagesPdf.forEach(p => URL.revokeObjectURL(p.url));
        convertedPagesPdf = [];
        fileInputPdf.value = '';
        uploadSectionPdf.style.display = 'block';
        optionsSectionPdf.style.display = 'none';
        progressSectionPdf.style.display = 'none';
        resultsSectionPdf.style.display = 'none';
        setPdfProgress(0, '');
    }

    // ============================================================
    // ===================== MODO IMAGEN → PDF =====================
    // ============================================================
    const dropZoneImg = $('#dropZoneImg');
    const fileInputImg = $('#fileInputImg');
    const uploadSectionImg = $('#uploadSectionImg');
    const optionsSectionImg = $('#optionsSectionImg');
    const progressSectionImg = $('#progressSectionImg');
    const resultsSectionImg = $('#resultsSectionImg');
    const fileNameImg = $('#fileNameImg');
    const removeFileImg = $('#removeFileImg');
    const imageQueue = $('#imageQueue');
    const pageSizeSelect = $('#pageSizeSelect');
    const orientationSelect = $('#orientationSelect');
    const imgQualityRange = $('#imgQualityRange');
    const imgQualityValue = $('#imgQualityValue');
    const convertBtnImg = $('#convertBtnImg');
    const progressTitleImg = $('#progressTitleImg');
    const progressPercentImg = $('#progressPercentImg');
    const progressFillImg = $('#progressFillImg');
    const resultsMetaImg = $('#resultsMetaImg');
    const pdfPreviewArea = $('#pdfPreviewArea');
    const pdfFileName = $('#pdfFileName');
    const downloadPdfBtn = $('#downloadPdfBtn');

    let imageFiles = []; 
    let isGeneratingPdf = false;
    let generatedPdfBlob = null;

    if (dropZoneImg && fileInputImg) {
        dropZoneImg.addEventListener('click', () => fileInputImg.click());
        fileInputImg.addEventListener('change', (e) => {
            if (e.target.files.length) handleImageFiles(Array.from(e.target.files));
        });

        dropZoneImg.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZoneImg.classList.add('dragover');
        });
        dropZoneImg.addEventListener('dragleave', () => dropZoneImg.classList.remove('dragover'));
        dropZoneImg.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneImg.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length) handleImageFiles(files);
            else showToast('Solo se permiten imágenes PNG o JPEG', 'error');
        });
    }

    if (imgQualityRange) {
        imgQualityRange.addEventListener('input', (e) => {
            imgQualityValue.textContent = e.target.value + '%';
        });
    }

    if (removeFileImg) removeFileImg.addEventListener('click', resetImgMode);
    if (convertBtnImg) convertBtnImg.addEventListener('click', startImgToPdf);

    function handleImageFiles(files) {
        const valid = files.filter(f => f.type === 'image/png' || f.type === 'image/jpeg' || f.type === 'image/jpg');
        if (!valid.length) {
            showToast('Solo se permiten imágenes PNG o JPEG', 'error');
            return;
        }

        valid.forEach(file => {
            const id = 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const url = URL.createObjectURL(file);
            imageFiles.push({ file, id, url });
        });

        renderImageQueue();
        updateImgUI();
    }

    function renderImageQueue() {
        if (!imageQueue) return;
        imageQueue.innerHTML = '';
        imageFiles.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'queue-item';
            div.dataset.id = item.id;
            div.innerHTML = `
                <img src="${item.url}" class="queue-thumb" alt="">
                <span class="queue-name" title="${item.file.name}">${item.file.name}</span>
                <span class="queue-size">${formatBytes(item.file.size)}</span>
                <div class="queue-controls">
                    <button class="queue-btn" title="Subir" data-action="up" data-id="${item.id}" ${index === 0 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button class="queue-btn" title="Bajar" data-action="down" data-id="${item.id}" ${index === imageFiles.length - 1 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <button class="queue-btn delete" title="Eliminar" data-action="delete" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `;
            imageQueue.appendChild(div);
        });

        imageQueue.querySelectorAll('.queue-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const idx = imageFiles.findIndex(i => i.id === id);

                if (action === 'up' && idx > 0) {
                    [imageFiles[idx], imageFiles[idx - 1]] = [imageFiles[idx - 1], imageFiles[idx]];
                    renderImageQueue();
                } else if (action === 'down' && idx < imageFiles.length - 1) {
                    [imageFiles[idx], imageFiles[idx + 1]] = [imageFiles[idx + 1], imageFiles[idx]];
                    renderImageQueue();
                } else if (action === 'delete') {
                    URL.revokeObjectURL(imageFiles[idx].url);
                    imageFiles.splice(idx, 1);
                    renderImageQueue();
                    updateImgUI();
                }
            });
        });
    }

    function updateImgUI() {
        const count = imageFiles.length;
        if (count > 0) {
            fileNameImg.textContent = `${count} imagen${count !== 1 ? 'es' : ''} seleccionada${count !== 1 ? 's' : ''}`;
            uploadSectionImg.style.display = 'none';
            optionsSectionImg.style.display = 'block';
            resultsSectionImg.style.display = 'none';
            progressSectionImg.style.display = 'none';
        } else {
            resetImgMode();
        }
    }

    async function startImgToPdf() {
        if (!imageFiles.length || isGeneratingPdf) return;

        const pageSize = pageSizeSelect.value;
        const orientation = orientationSelect.value;
        const total = imageFiles.length;

        isGeneratingPdf = true;

        optionsSectionImg.style.display = 'none';
        progressSectionImg.style.display = 'block';
        resultsSectionImg.style.display = 'none';
        setImgProgress(0, 'Preparando imágenes...');

        const btnLabel = convertBtnImg.querySelector('.btn-label');
        const btnSpinner = convertBtnImg.querySelector('.btn-spinner');
        btnLabel.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
        convertBtnImg.disabled = true;

        try {
            const { jsPDF } = window.jspdf;

            let pageWidth, pageHeight;
            const isLandscape = orientation === 'landscape';

            if (pageSize === 'a4') {
                pageWidth = 210; pageHeight = 297;
            } else if (pageSize === 'letter') {
                pageWidth = 215.9; pageHeight = 279.4;
            } else {
                pageWidth = 210; pageHeight = 297;
            }

            if (isLandscape) [pageWidth, pageHeight] = [pageHeight, pageWidth];

            const doc = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: pageSize === 'original' ? [pageWidth, pageHeight] : (pageSize === 'a4' ? 'a4' : 'letter')
            });

            for (let i = 0; i < total; i++) {
                setImgProgress((i / total) * 100, `Procesando imagen ${i + 1} de ${total}...`);

                const item = imageFiles[i];
                const imgData = await fileToBase64(item.file);
                const dims = await getImageDimensions(imgData);
                const imgRatio = dims.width / dims.height;

                let pw = doc.internal.pageSize.getWidth();
                let ph = doc.internal.pageSize.getHeight();

                const margin = 5;
                const maxW = pw - margin * 2;
                const maxH = ph - margin * 2;

                let drawW, drawH;
                const pageRatio = maxW / maxH;

                if (imgRatio > pageRatio) {
                    drawW = maxW;
                    drawH = drawW / imgRatio;
                } else {
                    drawH = maxH;
                    drawW = drawH * imgRatio;
                }

                const x = (pw - drawW) / 2;
                const y = (ph - drawH) / 2;

                if (i > 0) doc.addPage();

                const imgFormat = item.file.type === 'image/png' ? 'PNG' : 'JPEG';
                doc.addImage(imgData, imgFormat, x, y, drawW, drawH, undefined, 'FAST');
            }

            setImgProgress(100, 'Finalizando...');

            generatedPdfBlob = doc.output('blob');
            progressSectionImg.style.display = 'none';
            resultsSectionImg.style.display = 'block';

            const baseName = imageFiles.length === 1
                ? imageFiles[0].file.name.replace(/\.[^/.]+$/, '')
                : 'imagenes';
            pdfFileName.textContent = baseName + '.pdf';
            resultsMetaImg.textContent = `${total} imagen${total !== 1 ? 'es' : ''} en un PDF de ${formatBytes(generatedPdfBlob.size)}`;

            downloadPdfBtn.onclick = () => {
                saveAs(generatedPdfBlob, baseName + '.pdf');
            };

            showToast('PDF generado correctamente', 'success');

        } catch (err) {
            console.error(err);
            showToast('Error al generar PDF: ' + err.message, 'error');
            optionsSectionImg.style.display = 'block';
            progressSectionImg.style.display = 'none';
        } finally {
            isGeneratingPdf = false;
            btnLabel.style.display = 'inline';
            btnSpinner.style.display = 'none';
            convertBtnImg.disabled = false;
        }
    }

    function setImgProgress(percent, title) {
        progressFillImg.style.width = percent + '%';
        progressPercentImg.textContent = Math.round(percent) + '%';
        if (title) progressTitleImg.textContent = title;
    }

    function resetImgMode() {
        imageFiles.forEach(i => URL.revokeObjectURL(i.url));
        imageFiles = [];
        generatedPdfBlob = null;
        fileInputImg.value = '';
        uploadSectionImg.style.display = 'block';
        optionsSectionImg.style.display = 'none';
        progressSectionImg.style.display = 'none';
        resultsSectionImg.style.display = 'none';
        setImgProgress(0, '');
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function getImageDimensions(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = reject;
            img.src = dataUrl;
        });
    }
})();
