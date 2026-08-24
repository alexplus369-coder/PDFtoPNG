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


    function sortFiles(files, criterion) {
        const [key, dir] = criterion.split('-');
        const sorted = [...files];
        sorted.sort((a, b) => {
            let valA, valB;
            if (key === 'name') {
                valA = a.file.name.toLowerCase();
                valB = b.file.name.toLowerCase();
            } else if (key === 'date') {
                valA = a.file.lastModified || 0;
                valB = b.file.lastModified || 0;
            } else if (key === 'size') {
                valA = a.file.size || 0;
                valB = b.file.size || 0;
            } else {
                return 0;
            }
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
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
    const modePanels = {
        pdf2img: $('#pdf2imgPanel'),
        img2pdf: $('#img2pdfPanel'),
        mergepdf: $('#mergePdfPanel'),
        splitpdf: $('#splitPdfPanel'),
        renamefiles: $('#renameFilesPanel'),
        word2pdf: $('#word2pdfPanel'),
        pdf2word: $('#pdf2wordPanel'),
    };

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.mode;
            Object.entries(modePanels).forEach(([key, panel]) => {
                if (panel) panel.style.display = key === mode ? 'block' : 'none';
            });
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

    formatSelectorPdf.querySelectorAll('.segment').forEach(btn => {
        btn.addEventListener('click', () => {
            formatSelectorPdf.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const isJpeg = btn.dataset.value === 'jpeg';
            qualityRangePdf.disabled = !isJpeg;
            qualityValuePdf.textContent = isJpeg ? qualityRangePdf.value + '%' : '100%';
        });
    });

    qualityRangePdf.addEventListener('input', (e) => {
        qualityValuePdf.textContent = e.target.value + '%';
    });

    removeFilePdf.addEventListener('click', resetPdfMode);
    convertBtnPdf.addEventListener('click', startPdfConversion);
    cancelBtnPdf.addEventListener('click', () => {
        shouldCancelPdf = true;
        showToast('Cancelando...');
    });
    downloadZipBtnPdf.addEventListener('click', downloadPdfZip);

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

    let imageFiles = []; // {file, id, url}
    let isGeneratingPdf = false;
    let generatedPdfBlob = null;

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

    imgQualityRange.addEventListener('input', (e) => {
        imgQualityValue.textContent = e.target.value + '%';
    });

    removeFileImg.addEventListener('click', resetImgMode);
    convertBtnImg.addEventListener('click', startImgToPdf);

    const imgSortSelect = $('#imgSortSelect');
    if (imgSortSelect) {
        imgSortSelect.addEventListener('change', () => {
            if (imageFiles.length) {
                imageFiles = sortFiles(imageFiles, imgSortSelect.value);
                renderImageQueue();
            }
        });
    }

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

        const imgSortValue = $('#imgSortSelect') ? $('#imgSortSelect').value : 'name-asc';
        imageFiles = sortFiles(imageFiles, imgSortValue);

        renderImageQueue();
        updateImgUI();
    }

    function renderImageQueue() {
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
        const quality = parseInt(imgQualityRange.value) / 100;
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

            // Calcular tamaño de página
            let pageWidth, pageHeight;
            const isLandscape = orientation === 'landscape';

            if (pageSize === 'a4') {
                pageWidth = 210; pageHeight = 297;
            } else if (pageSize === 'letter') {
                pageWidth = 215.9; pageHeight = 279.4;
            } else {
                // Original: usamos el tamaño de la primera imagen como base temporal
                // se ajustará por imagen
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
                const MAX_IMG_LONG_SIDE = 2000;
                const processed = await preprocessImageForPdf(item.file, MAX_IMG_LONG_SIDE, quality);
                const imgData = processed.dataUrl;
                const dims = { width: processed.width, height: processed.height };
                const imgRatio = dims.width / dims.height;

                // Si es modo original, crear página del tamaño de la imagen (convertido a mm, asumiendo 96dpi)
                // 1 inch = 25.4mm, 96px = 1 inch en CSS, pero para impresión usamos 72dpi por defecto en jsPDF
                // Mejor: ajustar imagen al tamaño de página actual manteniendo aspecto
                let pw = doc.internal.pageSize.getWidth();
                let ph = doc.internal.pageSize.getHeight();

                if (pageSize === 'original') {
                    // Usar dimensiones originales en mm (asumiendo 72dpi: px / 72 * 25.4)
                    pw = (dims.width / 72) * 25.4;
                    ph = (dims.height / 72) * 25.4;
                    if (i === 0) {
                        // Recrear documento con tamaño correcto de primera imagen
                    }
                    // Para simplificar, ajustamos la imagen a la página actual manteniendo aspecto
                }

                // Calcular dimensiones ajustadas a la página con márgenes de 5mm
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

                // Si es JPEG, usar compresión. Si es PNG, jsPDF lo maneja bien.
                doc.addImage(imgData, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
            }

            setImgProgress(100, 'Finalizando...');

            generatedPdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(generatedPdfBlob);

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

function preprocessImageForPdf(file, maxLongSide, quality) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let w = img.width;
                let h = img.height;
                const longSide = Math.max(w, h);
                if (longSide > maxLongSide) {
                    const scale = maxLongSide / longSide;
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve({ dataUrl, width: w, height: h });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('No se pudo cargar la imagen'));
            };
            img.src = url;
        });
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

    // ============================================================
    // ===================== MODO UNIR PDF =====================
    // ============================================================
    const dropZoneMerge = $('#dropZoneMerge');
    const fileInputMerge = $('#fileInputMerge');
    const uploadSectionMerge = $('#uploadSectionMerge');
    const optionsSectionMerge = $('#optionsSectionMerge');
    const progressSectionMerge = $('#progressSectionMerge');
    const resultsSectionMerge = $('#resultsSectionMerge');
    const fileNameMerge = $('#fileNameMerge');
    const removeFileMerge = $('#removeFileMerge');
    const mergeQueue = $('#mergeQueue');
    const convertBtnMerge = $('#convertBtnMerge');
    const progressTitleMerge = $('#progressTitleMerge');
    const progressPercentMerge = $('#progressPercentMerge');
    const progressFillMerge = $('#progressFillMerge');
    const resultsMetaMerge = $('#resultsMetaMerge');
    const mergedFileNameEl = $('#mergedFileName');
    const downloadMergeBtn = $('#downloadMergeBtn');

    let mergeFiles = []; // {file, id}
    let isMerging = false;
    let mergedPdfBlob = null;

    dropZoneMerge.addEventListener('click', () => fileInputMerge.click());
    fileInputMerge.addEventListener('change', (e) => {
        if (e.target.files.length) handleMergeFiles(Array.from(e.target.files));
    });

    dropZoneMerge.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZoneMerge.classList.add('dragover');
    });
    dropZoneMerge.addEventListener('dragleave', () => dropZoneMerge.classList.remove('dragover'));
    dropZoneMerge.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZoneMerge.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        if (files.length) handleMergeFiles(files);
        else showToast('Solo se permiten archivos PDF', 'error');
    });

    removeFileMerge.addEventListener('click', resetMergeMode);
    convertBtnMerge.addEventListener('click', startMergePdf);

    const mergeSortSelect = $('#mergeSortSelect');
    if (mergeSortSelect) {
        mergeSortSelect.addEventListener('change', () => {
            if (mergeFiles.length) {
                mergeFiles = sortFiles(mergeFiles, mergeSortSelect.value);
                renderMergeQueue();
            }
        });
    }

    function handleMergeFiles(files) {
        const valid = files.filter(f => f.type === 'application/pdf');
        if (!valid.length) {
            showToast('Solo se permiten archivos PDF', 'error');
            return;
        }
        valid.forEach(file => {
            const id = 'pdf-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            mergeFiles.push({ file, id });
        });
        const mergeSortValue = $('#mergeSortSelect') ? $('#mergeSortSelect').value : 'name-asc';
        mergeFiles = sortFiles(mergeFiles, mergeSortValue);
        renderMergeQueue();
        updateMergeUI();
    }

    function renderMergeQueue() {
        mergeQueue.innerHTML = '';
        mergeFiles.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'queue-item';
            div.dataset.id = item.id;
            div.innerHTML = `
                <div class="queue-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--error);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                </div>
                <span class="queue-name" title="${item.file.name}">${item.file.name}</span>
                <span class="queue-size">${formatBytes(item.file.size)}</span>
                <div class="queue-controls">
                    <button class="queue-btn" title="Subir" data-action="up" data-id="${item.id}" ${index === 0 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button class="queue-btn" title="Bajar" data-action="down" data-id="${item.id}" ${index === mergeFiles.length - 1 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <button class="queue-btn delete" title="Eliminar" data-action="delete" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `;
            mergeQueue.appendChild(div);
        });

        mergeQueue.querySelectorAll('.queue-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const idx = mergeFiles.findIndex(i => i.id === id);

                if (action === 'up' && idx > 0) {
                    [mergeFiles[idx], mergeFiles[idx - 1]] = [mergeFiles[idx - 1], mergeFiles[idx]];
                    renderMergeQueue();
                } else if (action === 'down' && idx < mergeFiles.length - 1) {
                    [mergeFiles[idx], mergeFiles[idx + 1]] = [mergeFiles[idx + 1], mergeFiles[idx]];
                    renderMergeQueue();
                } else if (action === 'delete') {
                    mergeFiles.splice(idx, 1);
                    renderMergeQueue();
                    updateMergeUI();
                }
            });
        });
    }

    function updateMergeUI() {
        const count = mergeFiles.length;
        if (count > 0) {
            fileNameMerge.textContent = `${count} PDF${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`;
            uploadSectionMerge.style.display = 'none';
            optionsSectionMerge.style.display = 'block';
            resultsSectionMerge.style.display = 'none';
            progressSectionMerge.style.display = 'none';
        } else {
            resetMergeMode();
        }
    }

    async function startMergePdf() {
        if (mergeFiles.length < 2 || isMerging) {
            if (mergeFiles.length < 2) showToast('Selecciona al menos 2 PDFs para unir', 'warning');
            return;
        }

        isMerging = true;
        optionsSectionMerge.style.display = 'none';
        progressSectionMerge.style.display = 'block';
        resultsSectionMerge.style.display = 'none';
        setMergeProgress(0, 'Preparando...');

        const btnLabel = convertBtnMerge.querySelector('.btn-label');
        const btnSpinner = convertBtnMerge.querySelector('.btn-spinner');
        btnLabel.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
        convertBtnMerge.disabled = true;

        try {
            const { PDFDocument } = PDFLib;
            const mergedPdf = await PDFDocument.create();
            const total = mergeFiles.length;

            for (let i = 0; i < total; i++) {
                setMergeProgress((i / total) * 100, `Añadiendo ${mergeFiles[i].file.name}...`);
                const arrayBuffer = await mergeFiles[i].file.arrayBuffer();
                const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
                const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            setMergeProgress(95, 'Generando PDF final...');
            const mergedBytes = await mergedPdf.save();
            mergedPdfBlob = new Blob([mergedBytes], { type: 'application/pdf' });

            setMergeProgress(100, 'Completado');

            progressSectionMerge.style.display = 'none';
            resultsSectionMerge.style.display = 'block';
            mergedFileNameEl.textContent = 'documento-unido.pdf';
            resultsMetaMerge.textContent = `${total} PDFs unidos · ${mergedPdf.getPageCount()} páginas · ${formatBytes(mergedPdfBlob.size)}`;

            downloadMergeBtn.onclick = () => {
                saveAs(mergedPdfBlob, 'documento-unido.pdf');
            };

            showToast('PDFs unidos correctamente', 'success');
        } catch (err) {
            console.error(err);
            showToast('Error al unir PDFs: ' + err.message, 'error');
            optionsSectionMerge.style.display = 'block';
            progressSectionMerge.style.display = 'none';
        } finally {
            isMerging = false;
            btnLabel.style.display = 'inline';
            btnSpinner.style.display = 'none';
            convertBtnMerge.disabled = false;
        }
    }

    function setMergeProgress(percent, title) {
        progressFillMerge.style.width = percent + '%';
        progressPercentMerge.textContent = Math.round(percent) + '%';
        if (title) progressTitleMerge.textContent = title;
    }

    function resetMergeMode() {
        mergeFiles = [];
        mergedPdfBlob = null;
        isMerging = false;
        fileInputMerge.value = '';
        uploadSectionMerge.style.display = 'block';
        optionsSectionMerge.style.display = 'none';
        progressSectionMerge.style.display = 'none';
        resultsSectionMerge.style.display = 'none';
        setMergeProgress(0, '');
    }

    // ============================================================
    // ===================== MODO DIVIDIR PDF =====================
    // ============================================================
    const dropZoneSplit = $('#dropZoneSplit');
    const fileInputSplit = $('#fileInputSplit');
    const uploadSectionSplit = $('#uploadSectionSplit');
    const optionsSectionSplit = $('#optionsSectionSplit');
    const progressSectionSplit = $('#progressSectionSplit');
    const resultsSectionSplit = $('#resultsSectionSplit');
    const fileNameSplit = $('#fileNameSplit');
    const filePagesSplit = $('#filePagesSplit');
    const removeFileSplit = $('#removeFileSplit');
    const splitModeSelector = $('#splitModeSelector');
    const splitRangeField = $('#splitRangeField');
    const splitRangeInput = $('#splitRangeInput');
    const convertBtnSplit = $('#convertBtnSplit');
    const progressTitleSplit = $('#progressTitleSplit');
    const progressPercentSplit = $('#progressPercentSplit');
    const progressFillSplit = $('#progressFillSplit');
    const resultsMetaSplit = $('#resultsMetaSplit');
    const downloadZipBtnSplit = $('#downloadZipBtnSplit');
    const filesListSplit = $('#filesListSplit');

    let currentSplitFile = null;
    let splitSrcPdfBytes = null;
    let splitTotalPages = 0;
    let isSplitting = false;
    let splitResults = []; // {blob, name, range}

    dropZoneSplit.addEventListener('click', () => fileInputSplit.click());
    fileInputSplit.addEventListener('change', (e) => {
        if (e.target.files[0]) handleSplitFile(e.target.files[0]);
    });

    dropZoneSplit.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZoneSplit.classList.add('dragover');
    });
    dropZoneSplit.addEventListener('dragleave', () => dropZoneSplit.classList.remove('dragover'));
    dropZoneSplit.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZoneSplit.classList.remove('dragover');
        const f = e.dataTransfer.files[0];
        if (f && f.type === 'application/pdf') handleSplitFile(f);
        else showToast('Solo se permiten archivos PDF', 'error');
    });

    splitModeSelector.querySelectorAll('.segment').forEach(btn => {
        btn.addEventListener('click', () => {
            splitModeSelector.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            splitRangeField.style.display = btn.dataset.value === 'range' ? 'block' : 'none';
        });
    });

    removeFileSplit.addEventListener('click', resetSplitMode);
    convertBtnSplit.addEventListener('click', startSplitPdf);
    downloadZipBtnSplit.addEventListener('click', downloadSplitZip);

    async function handleSplitFile(file) {
        if (file.type !== 'application/pdf') {
            showToast('El archivo no es un PDF válido', 'error');
            return;
        }
        currentSplitFile = file;
        fileNameSplit.textContent = file.name;

        try {
            const arrayBuffer = await file.arrayBuffer();
            splitSrcPdfBytes = arrayBuffer;
            const { PDFDocument } = PDFLib;
            const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            splitTotalPages = pdf.getPageCount();
            filePagesSplit.textContent = `${splitTotalPages} página${splitTotalPages !== 1 ? 's' : ''}`;

            uploadSectionSplit.style.display = 'none';
            optionsSectionSplit.style.display = 'block';
            resultsSectionSplit.style.display = 'none';
            progressSectionSplit.style.display = 'none';
        } catch (err) {
            showToast('No se pudo leer el PDF', 'error');
        }
    }

    function parseRanges(input, maxPages) {
        const ranges = [];
        const parts = input.split(',').map(p => p.trim()).filter(Boolean);
        for (const part of parts) {
            const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
            if (m) {
                let start = parseInt(m[1]);
                let end = parseInt(m[2]);
                if (start > end) [start, end] = [end, start];
                start = Math.max(1, start);
                end = Math.min(maxPages, end);
                if (start <= end) ranges.push({ start, end });
            } else if (/^\d+$/.test(part)) {
                const n = parseInt(part);
                if (n >= 1 && n <= maxPages) ranges.push({ start: n, end: n });
            }
        }
        return ranges;
    }

    async function startSplitPdf() {
        if (!splitSrcPdfBytes || isSplitting) return;

        const mode = splitModeSelector.querySelector('.segment.active').dataset.value;
        let ranges = [];

        if (mode === 'all') {
            for (let i = 1; i <= splitTotalPages; i++) ranges.push({ start: i, end: i });
        } else {
            ranges = parseRanges(splitRangeInput.value, splitTotalPages);
            if (!ranges.length) {
                showToast('Ingresa al menos un rango válido, ej: 1-3, 5', 'error');
                return;
            }
        }

        isSplitting = true;
        optionsSectionSplit.style.display = 'none';
        progressSectionSplit.style.display = 'block';
        resultsSectionSplit.style.display = 'none';
        setSplitProgress(0, `Preparando ${ranges.length} archivo${ranges.length !== 1 ? 's' : ''}...`);

        const btnLabel = convertBtnSplit.querySelector('.btn-label');
        const btnSpinner = convertBtnSplit.querySelector('.btn-spinner');
        btnLabel.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
        convertBtnSplit.disabled = true;

        splitResults = [];
        const baseName = currentSplitFile.name.replace(/\.pdf$/i, '');

        try {
            const { PDFDocument } = PDFLib;
            const total = ranges.length;

            for (let i = 0; i < total; i++) {
                const range = ranges[i];
                setSplitProgress((i / total) * 100, `Generando archivo ${i + 1} de ${total}...`);

                const srcPdf = await PDFDocument.load(splitSrcPdfBytes, { ignoreEncryption: true });
                const newPdf = await PDFDocument.create();
                const indices = [];
                for (let p = range.start; p <= range.end; p++) indices.push(p - 1);
                const copiedPages = await newPdf.copyPages(srcPdf, indices);
                copiedPages.forEach(p => newPdf.addPage(p));

                const bytes = await newPdf.save();
                const blob = new Blob([bytes], { type: 'application/pdf' });
                const rangeLabel = range.start === range.end
                    ? `pagina-${String(range.start).padStart(3, '0')}`
                    : `paginas-${range.start}-${range.end}`;
                const name = `${baseName}-${rangeLabel}.pdf`;
                splitResults.push({ blob, name, range });
            }

            setSplitProgress(100, 'Completado');
            showSplitResults();
        } catch (err) {
            console.error(err);
            showToast('Error al dividir PDF: ' + err.message, 'error');
            optionsSectionSplit.style.display = 'block';
            progressSectionSplit.style.display = 'none';
        } finally {
            isSplitting = false;
            btnLabel.style.display = 'inline';
            btnSpinner.style.display = 'none';
            convertBtnSplit.disabled = false;
        }
    }

    function setSplitProgress(percent, title) {
        progressFillSplit.style.width = percent + '%';
        progressPercentSplit.textContent = Math.round(percent) + '%';
        if (title) progressTitleSplit.textContent = title;
    }

    function showSplitResults() {
        progressSectionSplit.style.display = 'none';
        resultsSectionSplit.style.display = 'block';
        resultsMetaSplit.textContent = `${splitResults.length} archivo${splitResults.length !== 1 ? 's' : ''} generado${splitResults.length !== 1 ? 's' : ''}`;

        filesListSplit.innerHTML = '';
        splitResults.forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'page-card';
            const label = item.range.start === item.range.end
                ? `Página ${item.range.start}`
                : `Páginas ${item.range.start}-${item.range.end}`;
            card.innerHTML = `
                <div class="page-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--error);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                </div>
                <div class="page-footer">
                    <span class="page-num">${label}</span>
                    <button class="page-dl" data-idx="${idx}">Descargar</button>
                </div>
            `;
            filesListSplit.appendChild(card);
        });

        filesListSplit.querySelectorAll('.page-dl').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = splitResults[parseInt(btn.dataset.idx)];
                saveAs(item.blob, item.name);
            });
        });
    }

    async function downloadSplitZip() {
        if (!splitResults.length) return;

        downloadZipBtnSplit.disabled = true;
        const originalHtml = downloadZipBtnSplit.innerHTML;
        downloadZipBtnSplit.innerHTML = `<svg class="spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/></svg> Generando...`;

        try {
            const zip = new JSZip();
            splitResults.forEach(item => zip.file(item.name, item.blob));
            const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            saveAs(content, 'pdf-dividido.zip');
            showToast('ZIP descargado', 'success');
        } catch (e) {
            showToast('Error al generar ZIP', 'error');
        } finally {
            downloadZipBtnSplit.disabled = false;
            downloadZipBtnSplit.innerHTML = originalHtml;
        }
    }

    function resetSplitMode() {
        currentSplitFile = null;
        splitSrcPdfBytes = null;
        splitTotalPages = 0;
        isSplitting = false;
        splitResults = [];
        fileInputSplit.value = '';
        uploadSectionSplit.style.display = 'block';
        optionsSectionSplit.style.display = 'none';
        progressSectionSplit.style.display = 'none';
        resultsSectionSplit.style.display = 'none';
        setSplitProgress(0, '');
    }

    // ============================================================
    // ================ MODO RENOMBRAR ARCHIVOS ==================
    // ============================================================
    const dropZoneRename = $('#dropZoneRename');
    const fileInputRename = $('#fileInputRename');
    const uploadSectionRename = $('#uploadSectionRename');
    const optionsSectionRename = $('#optionsSectionRename');
    const progressSectionRename = $('#progressSectionRename');
    const resultsSectionRename = $('#resultsSectionRename');
    const fileNameRename = $('#fileNameRename');
    const removeFileRename = $('#removeFileRename');
    const renameQueue = $('#renameQueue');
    const renamePrefixInput = $('#renamePrefixInput');
    const renameStartInput = $('#renameStartInput');
    const renamePadSelect = $('#renamePadSelect');
    const convertBtnRename = $('#convertBtnRename');
    const progressTitleRename = $('#progressTitleRename');
    const progressPercentRename = $('#progressPercentRename');
    const progressFillRename = $('#progressFillRename');
    const resultsMetaRename = $('#resultsMetaRename');
    const downloadZipBtnRename = $('#downloadZipBtnRename');
    const filesListRename = $('#filesListRename');

    let renameFiles = []; // {file, id, url, ext, isImage}
    let isRenaming = false;
    let renameResults = []; // {blob, name}

    dropZoneRename.addEventListener('click', () => fileInputRename.click());
    fileInputRename.addEventListener('change', (e) => {
        if (e.target.files.length) handleRenameFiles(Array.from(e.target.files));
    });

    dropZoneRename.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZoneRename.classList.add('dragover');
    });
    dropZoneRename.addEventListener('dragleave', () => dropZoneRename.classList.remove('dragover'));
    dropZoneRename.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZoneRename.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(isValidRenameFile);
        if (files.length) handleRenameFiles(files);
        else showToast('Solo se permiten PDF, PNG o JPEG', 'error');
    });

    removeFileRename.addEventListener('click', resetRenameMode);
    convertBtnRename.addEventListener('click', startRenameFiles);
    downloadZipBtnRename.addEventListener('click', downloadRenameZip);

    const renameSortSelect = $('#renameSortSelect');
    if (renameSortSelect) {
        renameSortSelect.addEventListener('change', () => {
            if (renameFiles.length) {
                renameFiles = sortFiles(renameFiles, renameSortSelect.value);
                renderRenameQueue();
            }
        });
    }

    [renamePrefixInput, renameStartInput, renamePadSelect].forEach(el => {
        el.addEventListener('input', updateRenamePreviews);
        el.addEventListener('change', updateRenamePreviews);
    });

    function isValidRenameFile(f) {
        return f.type === 'application/pdf' || f.type === 'image/png' || f.type === 'image/jpeg' || f.type === 'image/jpg';
    }

    function getFileExt(file) {
        const nameParts = file.name.split('.');
        const nameExt = nameParts.length > 1 ? nameParts.pop().toLowerCase() : '';
        if (nameExt && nameExt.length <= 5) return nameExt;
        if (file.type === 'application/pdf') return 'pdf';
        if (file.type === 'image/png') return 'png';
        return 'jpg';
    }

    function handleRenameFiles(files) {
        const valid = files.filter(isValidRenameFile);
        if (!valid.length) {
            showToast('Solo se permiten archivos PDF, PNG o JPEG', 'error');
            return;
        }
        valid.forEach(file => {
            const id = 'rn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const isImage = file.type.startsWith('image/');
            const url = isImage ? URL.createObjectURL(file) : null;
            renameFiles.push({ file, id, url, ext: getFileExt(file), isImage });
        });
        const renameSortValue = $('#renameSortSelect') ? $('#renameSortSelect').value : 'name-asc';
        renameFiles = sortFiles(renameFiles, renameSortValue);
        renderRenameQueue();
        updateRenameUI();
    }

    function computeRenameName(index, ext) {
        const prefix = renamePrefixInput.value || '';
        const start = parseInt(renameStartInput.value);
        const startNum = isNaN(start) ? 0 : start;
        const pad = parseInt(renamePadSelect.value) || 1;
        const num = String(startNum + index).padStart(pad, '0');
        return `${prefix}${num}.${ext}`;
    }

    function renderRenameQueue() {
        renameQueue.innerHTML = '';
        renameFiles.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'queue-item';
            div.dataset.id = item.id;

            const thumbHtml = item.isImage
                ? `<img src="${item.url}" class="queue-thumb" alt="">`
                : `<div class="queue-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--error);">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
                           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                           <polyline points="14 2 14 8 20 8"/>
                       </svg>
                   </div>`;

            div.innerHTML = `
                ${thumbHtml}
                <div class="queue-name-wrap">
                    <span class="queue-name" title="${item.file.name}">${item.file.name}</span>
                    <span class="queue-newname" data-preview="${item.id}">→ ${computeRenameName(index, item.ext)}</span>
                </div>
                <span class="queue-size">${formatBytes(item.file.size)}</span>
                <div class="queue-controls">
                    <button class="queue-btn" title="Subir" data-action="up" data-id="${item.id}" ${index === 0 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button class="queue-btn" title="Bajar" data-action="down" data-id="${item.id}" ${index === renameFiles.length - 1 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <button class="queue-btn delete" title="Eliminar" data-action="delete" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `;
            renameQueue.appendChild(div);
        });

        renameQueue.querySelectorAll('.queue-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                const idx = renameFiles.findIndex(i => i.id === id);

                if (action === 'up' && idx > 0) {
                    [renameFiles[idx], renameFiles[idx - 1]] = [renameFiles[idx - 1], renameFiles[idx]];
                    renderRenameQueue();
                } else if (action === 'down' && idx < renameFiles.length - 1) {
                    [renameFiles[idx], renameFiles[idx + 1]] = [renameFiles[idx + 1], renameFiles[idx]];
                    renderRenameQueue();
                } else if (action === 'delete') {
                    if (renameFiles[idx].url) URL.revokeObjectURL(renameFiles[idx].url);
                    renameFiles.splice(idx, 1);
                    renderRenameQueue();
                    updateRenameUI();
                }
            });
        });
    }

    function updateRenamePreviews() {
        renameFiles.forEach((item, index) => {
            const el = renameQueue.querySelector(`.queue-newname[data-preview="${item.id}"]`);
            if (el) el.textContent = `→ ${computeRenameName(index, item.ext)}`;
        });
    }

    function updateRenameUI() {
        const count = renameFiles.length;
        if (count > 0) {
            fileNameRename.textContent = `${count} archivo${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`;
            uploadSectionRename.style.display = 'none';
            optionsSectionRename.style.display = 'block';
            resultsSectionRename.style.display = 'none';
            progressSectionRename.style.display = 'none';
        } else {
            resetRenameMode();
        }
    }

    async function startRenameFiles() {
        if (!renameFiles.length || isRenaming) return;

        isRenaming = true;
        optionsSectionRename.style.display = 'none';
        progressSectionRename.style.display = 'block';
        resultsSectionRename.style.display = 'none';
        setRenameProgress(0, 'Preparando archivos...');

        const btnLabel = convertBtnRename.querySelector('.btn-label');
        const btnSpinner = convertBtnRename.querySelector('.btn-spinner');
        btnLabel.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
        convertBtnRename.disabled = true;

        renameResults = [];
        const total = renameFiles.length;

        try {
            const usedNames = new Set();
            for (let i = 0; i < total; i++) {
                setRenameProgress((i / total) * 90, `Renombrando ${i + 1} de ${total}...`);
                const item = renameFiles[i];
                let name = computeRenameName(i, item.ext);
                // Evitar colisiones si dos archivos generan el mismo nombre
                let suffix = 1;
                while (usedNames.has(name)) {
                    name = computeRenameName(i, item.ext).replace(/(\.[^.]+)$/, `-${suffix}$1`);
                    suffix++;
                }
                usedNames.add(name);
                renameResults.push({ blob: item.file, name });
            }

            setRenameProgress(100, 'Completado');
            showRenameResults();
        } catch (err) {
            console.error(err);
            showToast('Error al renombrar: ' + err.message, 'error');
            optionsSectionRename.style.display = 'block';
            progressSectionRename.style.display = 'none';
        } finally {
            isRenaming = false;
            btnLabel.style.display = 'inline';
            btnSpinner.style.display = 'none';
            convertBtnRename.disabled = false;
        }
    }

    function setRenameProgress(percent, title) {
        progressFillRename.style.width = percent + '%';
        progressPercentRename.textContent = Math.round(percent) + '%';
        if (title) progressTitleRename.textContent = title;
    }

    function showRenameResults() {
        progressSectionRename.style.display = 'none';
        resultsSectionRename.style.display = 'block';
        resultsMetaRename.textContent = `${renameResults.length} archivo${renameResults.length !== 1 ? 's' : ''} listo${renameResults.length !== 1 ? 's' : ''}`;

        filesListRename.innerHTML = '';
        renameResults.forEach((item, idx) => {
            const isImage = item.blob.type && item.blob.type.startsWith('image/');
            const card = document.createElement('div');
            card.className = 'page-card';

            const thumbHtml = isImage
                ? `<img src="${URL.createObjectURL(item.blob)}" alt="${item.name}" class="page-thumb" loading="lazy">`
                : `<div class="page-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--error);">
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                           <polyline points="14 2 14 8 20 8"/>
                       </svg>
                   </div>`;

            card.innerHTML = `
                ${thumbHtml}
                <div class="page-footer">
                    <span class="page-num" title="${item.name}">${item.name}</span>
                    <button class="page-dl" data-idx="${idx}">Descargar</button>
                </div>
            `;
            filesListRename.appendChild(card);
        });

        filesListRename.querySelectorAll('.page-dl').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = renameResults[parseInt(btn.dataset.idx)];
                saveAs(item.blob, item.name);
            });
        });
    }

    async function downloadRenameZip() {
        if (!renameResults.length) return;

        downloadZipBtnRename.disabled = true;
        const originalHtml = downloadZipBtnRename.innerHTML;
        downloadZipBtnRename.innerHTML = `<svg class="spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/></svg> Generando...`;

        try {
            const zip = new JSZip();
            renameResults.forEach(item => zip.file(item.name, item.blob));
            const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            saveAs(content, 'archivos-renombrados.zip');
            showToast('ZIP descargado', 'success');
        } catch (e) {
            showToast('Error al generar ZIP', 'error');
        } finally {
            downloadZipBtnRename.disabled = false;
            downloadZipBtnRename.innerHTML = originalHtml;
        }
    }

    function resetRenameMode() {
        renameFiles.forEach(item => { if (item.url) URL.revokeObjectURL(item.url); });
        renameFiles = [];
        renameResults = [];
        isRenaming = false;
        fileInputRename.value = '';
        uploadSectionRename.style.display = 'block';
        optionsSectionRename.style.display = 'none';
        progressSectionRename.style.display = 'none';
        resultsSectionRename.style.display = 'none';
        setRenameProgress(0, '');
    }

    // ============================================================
    // ============ HELPERS COMPARTIDOS: LISTAS Y ZIP =============
    // ============================================================
    function pdfIconSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>`;
    }

    function wordIconSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M7.5 13l1.3 4.5 1.2-4.5 1.2 4.5 1.3-4.5"/>
        </svg>`;
    }

    function renderResultsList(container, results, color, iconSvg) {
        container.innerHTML = '';
        results.forEach((item, idx) => {
            const card = document.createElement('div');
            card.className = 'page-card';
            card.innerHTML = `
                <div class="page-thumb" style="display:flex;align-items:center;justify-content:center;color:${color};">
                    ${iconSvg}
                </div>
                <div class="page-footer">
                    <span class="page-num" title="${item.name}">${item.name}</span>
                    <button class="page-dl" data-idx="${idx}">Descargar</button>
                </div>
            `;
            container.appendChild(card);
        });
        container.querySelectorAll('.page-dl').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = results[parseInt(btn.dataset.idx)];
                saveAs(item.blob, item.name);
            });
        });
    }

    async function downloadResultsZip(results, zipName, btnEl) {
        if (!results.length) return;
        btnEl.disabled = true;
        const originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = `<svg class="spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/></svg> Generando...`;
        try {
            const zip = new JSZip();
            results.forEach(item => zip.file(item.name, item.blob));
            const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            saveAs(content, zipName);
            showToast('ZIP descargado', 'success');
        } catch (e) {
            showToast('Error al generar ZIP', 'error');
        } finally {
            btnEl.disabled = false;
            btnEl.innerHTML = originalHtml;
        }
    }

    // Cola genérica (solo eliminar, sin reordenar) para modos Word<->PDF
    function renderSimpleQueue(container, files, iconColor, onDelete) {
        container.innerHTML = '';
        files.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'queue-item';
            div.dataset.id = item.id;
            div.innerHTML = `
                <div class="queue-thumb" style="display:flex;align-items:center;justify-content:center;color:${iconColor};">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                </div>
                <span class="queue-name" title="${item.file.name}">${item.file.name}</span>
                <span class="queue-size">${formatBytes(item.file.size)}</span>
                <div class="queue-controls">
                    <button class="queue-btn delete" title="Eliminar" data-id="${item.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
        container.querySelectorAll('.queue-btn.delete').forEach(btn => {
            btn.addEventListener('click', () => onDelete(btn.dataset.id));
        });
    }

    // ============================================================
    // ========= MOTOR: WORD (.docx) → PDF con texto real =========
    // ============================================================
    // Usa mammoth.js para extraer el HTML estructurado del .docx y lo
    // vuelve a dibujar en jsPDF como texto real (no una imagen rasterizada),
    // preservando negritas, cursivas, títulos, listas, tablas e imágenes.

    function ensureSpace(ctx, neededHeight) {
        if (ctx.y + neededHeight > ctx.pageHeight - ctx.marginBottom) {
            ctx.pdf.addPage();
            ctx.y = ctx.marginTop;
        }
    }

    function collectRuns(node, bold, italic, runs) {
        node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                if (child.textContent) runs.push({ text: child.textContent, bold, italic });
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toLowerCase();
                if (tag === 'br') {
                    runs.push({ isBreak: true });
                    return;
                }
                const nb = bold || tag === 'strong' || tag === 'b';
                const ni = italic || tag === 'em' || tag === 'i';
                collectRuns(child, nb, ni, runs);
            }
        });
        return runs;
    }

    function renderRuns(ctx, runs, size, indent) {
        const pdf = ctx.pdf;
        const lineHeight = size * 1.32;
        const startX = ctx.marginX + indent;
        const maxW = ctx.maxWidth - indent;

        const words = [];
        runs.forEach(run => {
            if (run.isBreak) { words.push({ isBreakToken: true }); return; }
            const parts = run.text.split(/(\s+)/).filter(p => p.length > 0);
            parts.forEach(p => {
                if (/^\s+$/.test(p)) {
                    words.push({ text: ' ', bold: run.bold, italic: run.italic, isSpace: true });
                } else {
                    words.push({ text: p, bold: run.bold, italic: run.italic });
                }
            });
        });
        if (!words.length) return;

        function setFontFor(w) {
            let style = 'normal';
            if (w.bold && w.italic) style = 'bolditalic';
            else if (w.bold) style = 'bold';
            else if (w.italic) style = 'italic';
            pdf.setFont(ctx.fontFamily, style);
            pdf.setFontSize(size);
        }

        let lineWords = [];
        let x = startX;

        function flushLine() {
            if (!lineWords.length) { ctx.y += lineHeight; return; }
            ensureSpace(ctx, lineHeight);
            let cx = startX;
            lineWords.forEach(w => {
                setFontFor(w);
                pdf.text(w.text, cx, ctx.y);
                cx += pdf.getTextWidth(w.text);
            });
            ctx.y += lineHeight;
            lineWords = [];
            x = startX;
        }

        words.forEach(w => {
            if (w.isBreakToken) { flushLine(); return; }
            setFontFor(w);
            const wWidth = pdf.getTextWidth(w.text);
            if (w.isSpace) {
                if (x + wWidth <= startX + maxW && lineWords.length) {
                    lineWords.push(w);
                    x += wWidth;
                }
                return;
            }
            if (x + wWidth > startX + maxW && lineWords.length) {
                flushLine();
            }
            lineWords.push(w);
            x += wWidth;
        });
        flushLine();
    }

    function renderParagraphEl(ctx, el, baseSize, indent, forceBold) {
        const runs = collectRuns(el, !!forceBold, false, []);
        renderRuns(ctx, runs, baseSize, indent);
    }

    function renderHeading(ctx, node, size) {
        ctx.y += 6;
        renderParagraphEl(ctx, node, size, 0, true);
        ctx.y += 8;
    }

    function renderList(ctx, listEl, ordered) {
        let idx = 1;
        const lineHeight = 11 * 1.32;
        Array.from(listEl.children).forEach(li => {
            if (li.tagName.toLowerCase() !== 'li') return;
            ensureSpace(ctx, lineHeight);
            const bullet = ordered ? `${idx}.` : '•';
            idx++;
            ctx.pdf.setFont(ctx.fontFamily, 'normal');
            ctx.pdf.setFontSize(11);
            ctx.pdf.text(bullet, ctx.marginX + 4, ctx.y);
            renderParagraphEl(ctx, li, 11, 22);
        });
        ctx.y += 4;
    }

    function renderTable(ctx, tableEl) {
        const pdf = ctx.pdf;
        const rows = Array.from(tableEl.querySelectorAll(':scope > tbody > tr, :scope > tr, :scope > thead > tr'));
        const allRows = rows.length ? rows : Array.from(tableEl.querySelectorAll('tr'));
        if (!allRows.length) return;

        const colCount = Math.max(...allRows.map(r => r.children.length)) || 1;
        const colWidth = ctx.maxWidth / colCount;
        const cellPadding = 4;
        const fontSize = 9;
        const lineHeight = fontSize * 1.3;

        allRows.forEach(row => {
            const cells = Array.from(row.children);
            const cellLines = cells.map(cell => {
                const text = cell.textContent.replace(/\s+/g, ' ').trim();
                const isHeader = cell.tagName.toLowerCase() === 'th';
                pdf.setFont(ctx.fontFamily, isHeader ? 'bold' : 'normal');
                pdf.setFontSize(fontSize);
                const lines = pdf.splitTextToSize(text || ' ', colWidth - cellPadding * 2);
                return { lines, isHeader };
            });
            const rowHeight = Math.max(1, ...cellLines.map(c => c.lines.length)) * lineHeight + cellPadding * 2;

            ensureSpace(ctx, rowHeight);
            let cx = ctx.marginX;
            cellLines.forEach(({ lines, isHeader }) => {
                pdf.setDrawColor(200);
                pdf.rect(cx, ctx.y, colWidth, rowHeight);
                pdf.setFont(ctx.fontFamily, isHeader ? 'bold' : 'normal');
                pdf.setFontSize(fontSize);
                lines.forEach((line, li) => {
                    pdf.text(line, cx + cellPadding, ctx.y + cellPadding + (li + 1) * lineHeight - lineHeight * 0.25);
                });
                cx += colWidth;
            });
            ctx.y += rowHeight;
        });
        ctx.y += 8;
    }

    async function renderImage(ctx, imgEl) {
        const src = imgEl.getAttribute('src');
        if (!src || !src.startsWith('data:image')) return;
        try {
            const mimeMatch = src.match(/^data:image\/(png|jpe?g);base64,/i);
            const format = mimeMatch && mimeMatch[1].toLowerCase() === 'png' ? 'PNG' : 'JPEG';
            const dims = await getImageDimensions(src);
            let drawW = ctx.maxWidth;
            let drawH = drawW * (dims.height / dims.width);
            const maxH = ctx.pageHeight - ctx.marginTop - ctx.marginBottom;
            if (drawH > maxH) {
                drawH = maxH;
                drawW = drawH * (dims.width / dims.height);
            }
            ensureSpace(ctx, drawH + 8);
            ctx.pdf.addImage(src, format, ctx.marginX, ctx.y, drawW, drawH);
            ctx.y += drawH + 8;
        } catch (e) {
            console.warn('No se pudo insertar una imagen del documento', e);
        }
    }

    async function renderDocNode(ctx, node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toLowerCase();
        switch (tag) {
            case 'h1': renderHeading(ctx, node, 20); break;
            case 'h2': renderHeading(ctx, node, 17); break;
            case 'h3': renderHeading(ctx, node, 15); break;
            case 'h4': renderHeading(ctx, node, 13); break;
            case 'h5': renderHeading(ctx, node, 12); break;
            case 'h6': renderHeading(ctx, node, 11); break;
            case 'p':
                renderParagraphEl(ctx, node, 11, 0);
                ctx.y += 6;
                break;
            case 'ul': renderList(ctx, node, false); break;
            case 'ol': renderList(ctx, node, true); break;
            case 'table': renderTable(ctx, node); break;
            case 'img': await renderImage(ctx, node); break;
            case 'hr':
                ensureSpace(ctx, 10);
                ctx.pdf.setDrawColor(220);
                ctx.pdf.line(ctx.marginX, ctx.y, ctx.pageWidth - ctx.marginX, ctx.y);
                ctx.y += 14;
                break;
            default:
                for (const child of Array.from(node.childNodes)) {
                    await renderDocNode(ctx, child);
                }
        }
    }

    async function convertDocxToPdf(file, pageFormat) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;

        const parser = new DOMParser();
        const parsedDoc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const root = parsedDoc.body.firstChild;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'pt', format: pageFormat === 'letter' ? 'letter' : 'a4' });

        const marginX = 56;
        const marginTop = 56;
        const marginBottom = 56;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const ctx = {
            pdf,
            y: marginTop,
            marginX, marginTop, marginBottom,
            pageWidth, pageHeight,
            maxWidth: pageWidth - marginX * 2,
            fontFamily: 'helvetica'
        };

        pdf.setFont(ctx.fontFamily, 'normal');
        pdf.setFontSize(11);

        for (const child of Array.from(root.childNodes)) {
            await renderDocNode(ctx, child);
        }

        return pdf.output('blob');
    }

    // ============================================================
    // ====== MOTOR: PDF → WORD (.docx editable) con pdf.js =======
    // ============================================================
    // Extrae el texto de cada página respetando líneas y párrafos por
    // posición, detecta negrita/cursiva por el nombre de la fuente y
    // conserva los saltos de página originales del PDF.

    function groupTextItemsIntoLines(items) {
        const mapped = items
            .filter(it => typeof it.str === 'string')
            .map(it => ({
                str: it.str,
                x: it.transform[4],
                y: it.transform[5],
                height: it.height || Math.abs(it.transform[3]) || 10,
                width: it.width || 0,
                fontName: it.fontName || ''
            }));

        mapped.sort((a, b) => (b.y - a.y) || (a.x - b.x));

        const lines = [];
        let current = null;
        const Y_TOL = 2.5;

        mapped.forEach(it => {
            if (!current || Math.abs(it.y - current.y) > Math.max(Y_TOL, it.height * 0.45)) {
                current = { y: it.y, avgHeight: it.height, items: [] };
                lines.push(current);
            }
            current.items.push(it);
        });

        lines.forEach(line => line.items.sort((a, b) => a.x - b.x));
        return lines;
    }

    function buildRunsForLine(line, TextRun) {
        const runs = [];
        let buffer = '';
        let curBold = null;
        let curItalic = null;
        let prevItem = null;

        line.items.forEach(it => {
            const fname = (it.fontName || '').toLowerCase();
            const bold = fname.includes('bold');
            const italic = fname.includes('italic') || fname.includes('oblique');

            let text = it.str;
            if (prevItem) {
                const gap = it.x - (prevItem.x + prevItem.width);
                if (gap > prevItem.height * 0.15 && !/^\s/.test(text) && !/\s$/.test(prevItem.str)) {
                    text = ' ' + text;
                }
            }

            if (curBold === null) { curBold = bold; curItalic = italic; }

            if (bold === curBold && italic === curItalic) {
                buffer += text;
            } else {
                if (buffer) runs.push(new TextRun({ text: buffer, bold: curBold, italics: curItalic }));
                buffer = text;
                curBold = bold;
                curItalic = italic;
            }
            prevItem = it;
        });
        if (buffer) runs.push(new TextRun({ text: buffer, bold: curBold, italics: curItalic }));
        if (!runs.length) runs.push(new TextRun({ text: '' }));
        return runs;
    }

    async function convertPdfToDocx(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const { Document, Packer, Paragraph, TextRun, PageBreak } = window.docx;

        const children = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const lines = groupTextItemsIntoLines(textContent.items);

            let prevY = null;
            lines.forEach(line => {
                const lineText = line.items.map(it => it.str).join('').trim();
                if (prevY !== null) {
                    const gap = prevY - line.y;
                    if (gap > line.avgHeight * 1.9) {
                        children.push(new Paragraph({ text: '' }));
                    }
                }
                if (lineText) {
                    children.push(new Paragraph({ children: buildRunsForLine(line, TextRun) }));
                } else {
                    children.push(new Paragraph({ text: '' }));
                }
                prevY = line.y;
            });

            if (lines.length === 0) {
                children.push(new Paragraph({ text: '' }));
            }

            if (pageNum < pdf.numPages) {
                children.push(new Paragraph({ children: [new PageBreak()] }));
            }
        }

        if (!children.length) children.push(new Paragraph({ text: '' }));

        const doc = new Document({ sections: [{ properties: {}, children }] });
        return await Packer.toBlob(doc);
    }

    // ============================================================
    // ===================== MODO WORD A PDF =======================
    // ============================================================
    const dropZoneW2P = $('#dropZoneW2P');
    const fileInputW2P = $('#fileInputW2P');
    const uploadSectionW2P = $('#uploadSectionW2P');
    const optionsSectionW2P = $('#optionsSectionW2P');
    const progressSectionW2P = $('#progressSectionW2P');
    const resultsSectionW2P = $('#resultsSectionW2P');
    const fileNameW2P = $('#fileNameW2P');
    const removeFileW2P = $('#removeFileW2P');
    const w2pQueueEl = $('#w2pQueue');
    const w2pFormatSelector = $('#w2pFormatSelector');
    const convertBtnW2P = $('#convertBtnW2P');
    const progressTitleW2P = $('#progressTitleW2P');
    const progressPercentW2P = $('#progressPercentW2P');
    const progressFillW2P = $('#progressFillW2P');
    const resultsMetaW2P = $('#resultsMetaW2P');
    const downloadZipBtnW2P = $('#downloadZipBtnW2P');
    const filesListW2P = $('#filesListW2P');

    let w2pFiles = [];
    let isConvertingW2P = false;
    let w2pResults = [];

    dropZoneW2P.addEventListener('click', () => fileInputW2P.click());
    fileInputW2P.addEventListener('change', (e) => {
        if (e.target.files.length) handleW2PFiles(Array.from(e.target.files));
    });
    dropZoneW2P.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneW2P.classList.add('dragover'); });
    dropZoneW2P.addEventListener('dragleave', () => dropZoneW2P.classList.remove('dragover'));
    dropZoneW2P.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZoneW2P.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.docx'));
        if (files.length) handleW2PFiles(files);
        else showToast('Solo se permiten archivos .docx', 'error');
    });

    w2pFormatSelector.querySelectorAll('.segment').forEach(btn => {
        btn.addEventListener('click', () => {
            w2pFormatSelector.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    removeFileW2P.addEventListener('click', resetW2PMode);
    convertBtnW2P.addEventListener('click', startW2PConvert);
    downloadZipBtnW2P.addEventListener('click', () => downloadResultsZip(w2pResults, 'documentos-pdf.zip', downloadZipBtnW2P));

    const w2pSortSelect = $('#w2pSortSelect');
    if (w2pSortSelect) {
        w2pSortSelect.addEventListener('change', () => {
            if (w2pFiles.length) {
                w2pFiles = sortFiles(w2pFiles, w2pSortSelect.value);
                redrawW2PQueue();
            }
        });
    }

    function handleW2PFiles(files) {
        const valid = files.filter(f => f.name.toLowerCase().endsWith('.docx'));
        if (!valid.length) {
            showToast('Solo se permiten archivos .docx', 'error');
            return;
        }
        valid.forEach(file => {
            const id = 'w2p-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            w2pFiles.push({ file, id });
        });
        const w2pSortValue = $('#w2pSortSelect') ? $('#w2pSortSelect').value : 'name-asc';
        w2pFiles = sortFiles(w2pFiles, w2pSortValue);
        redrawW2PQueue();
        updateW2PUI();
    }

    function redrawW2PQueue() {
        renderSimpleQueue(w2pQueueEl, w2pFiles, '#2b579a', (id) => {
            w2pFiles = w2pFiles.filter(i => i.id !== id);
            redrawW2PQueue();
            updateW2PUI();
        });
    }

    function updateW2PUI() {
        const count = w2pFiles.length;
        if (count > 0) {
            fileNameW2P.textContent = `${count} archivo${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`;
            uploadSectionW2P.style.display = 'none';
            optionsSectionW2P.style.display = 'block';
            resultsSectionW2P.style.display = 'none';
            progressSectionW2P.style.display = 'none';
        } else {
            resetW2PMode();
        }
    }

    function setW2PProgress(percent, title) {
        progressFillW2P.style.width = percent + '%';
        progressPercentW2P.textContent = Math.round(percent) + '%';
        if (title) progressTitleW2P.textContent = title;
    }

    async function startW2PConvert() {
        if (!w2pFiles.length || isConvertingW2P) return;

        isConvertingW2P = true;
        optionsSectionW2P.style.display = 'none';
        progressSectionW2P.style.display = 'block';
        resultsSectionW2P.style.display = 'none';
        setW2PProgress(0, 'Preparando...');

        const btnLabel = convertBtnW2P.querySelector('.btn-label');
        const btnSpinner = convertBtnW2P.querySelector('.btn-spinner');
        btnLabel.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
        convertBtnW2P.disabled = true;

        const pageFormat = w2pFormatSelector.querySelector('.segment.active').dataset.value;
        w2pResults = [];
        const total = w2pFiles.length;

        try {
            for (let i = 0; i < total; i++) {
                const item = w2pFiles[i];
                setW2PProgress((i / total) * 100, `Convirtiendo ${item.file.name}...`);
                const blob = await convertDocxToPdf(item.file, pageFormat);
                const name = item.file.name.replace(/\.docx$/i, '.pdf');
                w2pResults.push({ blob, name });
            }

            setW2PProgress(100, 'Completado');
            resultsSectionW2P.style.display = 'block';
            progressSectionW2P.style.display = 'none';
            resultsMetaW2P.textContent = `${w2pResults.length} archivo${w2pResults.length !== 1 ? 's' : ''} listo${w2pResults.length !== 1 ? 's' : ''}`;
            renderResultsList(filesListW2P, w2pResults, 'var(--error)', pdfIconSvg());
            showToast('Conversión completada', 'success');
        } catch (err) {
            console.error(err);
            showToast('Error al convertir: ' + err.message, 'error');
            optionsSectionW2P.style.display = 'block';
            progressSectionW2P.style.display = 'none';
        } finally {
            isConvertingW2P = false;
            btnLabel.style.display = 'inline';
            btnSpinner.style.display = 'none';
            convertBtnW2P.disabled = false;
        }
    }

    function resetW2PMode() {
        w2pFiles = [];
        w2pResults = [];
        isConvertingW2P = false;
        fileInputW2P.value = '';
        uploadSectionW2P.style.display = 'block';
        optionsSectionW2P.style.display = 'none';
        progressSectionW2P.style.display = 'none';
        resultsSectionW2P.style.display = 'none';
        setW2PProgress(0, '');
    }

    // ============================================================
    // ===================== MODO PDF A WORD =======================
    // ============================================================
    const dropZoneP2W = $('#dropZoneP2W');
    const fileInputP2W = $('#fileInputP2W');
    const uploadSectionP2W = $('#uploadSectionP2W');
    const optionsSectionP2W = $('#optionsSectionP2W');
    const progressSectionP2W = $('#progressSectionP2W');
    const resultsSectionP2W = $('#resultsSectionP2W');
    const fileNameP2W = $('#fileNameP2W');
    const removeFileP2W = $('#removeFileP2W');
    const p2wQueueEl = $('#p2wQueue');
    const convertBtnP2W = $('#convertBtnP2W');
    const progressTitleP2W = $('#progressTitleP2W');
    const progressPercentP2W = $('#progressPercentP2W');
    const progressFillP2W = $('#progressFillP2W');
    const resultsMetaP2W = $('#resultsMetaP2W');
    const downloadZipBtnP2W = $('#downloadZipBtnP2W');
    const filesListP2W = $('#filesListP2W');

    let p2wFiles = [];
    let isConvertingP2W = false;
    let p2wResults = [];

    dropZoneP2W.addEventListener('click', () => fileInputP2W.click());
    fileInputP2W.addEventListener('change', (e) => {
        if (e.target.files.length) handleP2WFiles(Array.from(e.target.files));
    });
    dropZoneP2W.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneP2W.classList.add('dragover'); });
    dropZoneP2W.addEventListener('dragleave', () => dropZoneP2W.classList.remove('dragover'));
    dropZoneP2W.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZoneP2W.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        if (files.length) handleP2WFiles(files);
        else showToast('Solo se permiten archivos PDF', 'error');
    });

    removeFileP2W.addEventListener('click', resetP2WMode);
    convertBtnP2W.addEventListener('click', startP2WConvert);
    downloadZipBtnP2W.addEventListener('click', () => downloadResultsZip(p2wResults, 'documentos-word.zip', downloadZipBtnP2W));

    const p2wSortSelect = $('#p2wSortSelect');
    if (p2wSortSelect) {
        p2wSortSelect.addEventListener('change', () => {
            if (p2wFiles.length) {
                p2wFiles = sortFiles(p2wFiles, p2wSortSelect.value);
                redrawP2WQueue();
            }
        });
    }

    function handleP2WFiles(files) {
        const valid = files.filter(f => f.type === 'application/pdf');
        if (!valid.length) {
            showToast('Solo se permiten archivos PDF', 'error');
            return;
        }
        valid.forEach(file => {
            const id = 'p2w-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            p2wFiles.push({ file, id });
        });
        const p2wSortValue = $('#p2wSortSelect') ? $('#p2wSortSelect').value : 'name-asc';
        p2wFiles = sortFiles(p2wFiles, p2wSortValue);
        redrawP2WQueue();
        updateP2WUI();
    }

    function redrawP2WQueue() {
        renderSimpleQueue(p2wQueueEl, p2wFiles, 'var(--error)', (id) => {
            p2wFiles = p2wFiles.filter(i => i.id !== id);
            redrawP2WQueue();
            updateP2WUI();
        });
    }

    function updateP2WUI() {
        const count = p2wFiles.length;
        if (count > 0) {
            fileNameP2W.textContent = `${count} archivo${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`;
            uploadSectionP2W.style.display = 'none';
            optionsSectionP2W.style.display = 'block';
            resultsSectionP2W.style.display = 'none';
            progressSectionP2W.style.display = 'none';
        } else {
            resetP2WMode();
        }
    }

    function setP2WProgress(percent, title) {
        progressFillP2W.style.width = percent + '%';
        progressPercentP2W.textContent = Math.round(percent) + '%';
        if (title) progressTitleP2W.textContent = title;
    }

    async function startP2WConvert() {
        if (!p2wFiles.length || isConvertingP2W) return;

        isConvertingP2W = true;
        optionsSectionP2W.style.display = 'none';
        progressSectionP2W.style.display = 'block';
        resultsSectionP2W.style.display = 'none';
        setP2WProgress(0, 'Preparando...');

        const btnLabel = convertBtnP2W.querySelector('.btn-label');
        const btnSpinner = convertBtnP2W.querySelector('.btn-spinner');
        btnLabel.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
        convertBtnP2W.disabled = true;

        p2wResults = [];
        const total = p2wFiles.length;

        try {
            for (let i = 0; i < total; i++) {
                const item = p2wFiles[i];
                setP2WProgress((i / total) * 100, `Convirtiendo ${item.file.name}...`);
                const blob = await convertPdfToDocx(item.file);
                const name = item.file.name.replace(/\.pdf$/i, '.docx');
                p2wResults.push({ blob, name });
            }

            setP2WProgress(100, 'Completado');
            resultsSectionP2W.style.display = 'block';
            progressSectionP2W.style.display = 'none';
            resultsMetaP2W.textContent = `${p2wResults.length} archivo${p2wResults.length !== 1 ? 's' : ''} listo${p2wResults.length !== 1 ? 's' : ''}`;
            renderResultsList(filesListP2W, p2wResults, '#2b579a', wordIconSvg());
            showToast('Conversión completada', 'success');
        } catch (err) {
            console.error(err);
            showToast('Error al convertir: ' + err.message, 'error');
            optionsSectionP2W.style.display = 'block';
            progressSectionP2W.style.display = 'none';
        } finally {
            isConvertingP2W = false;
            btnLabel.style.display = 'inline';
            btnSpinner.style.display = 'none';
            convertBtnP2W.disabled = false;
        }
    }

    function resetP2WMode() {
        p2wFiles = [];
        p2wResults = [];
        isConvertingP2W = false;
        fileInputP2W.value = '';
        uploadSectionP2W.style.display = 'block';
        optionsSectionP2W.style.display = 'none';
        progressSectionP2W.style.display = 'none';
        resultsSectionP2W.style.display = 'none';
        setP2WProgress(0, '');
    }
})();
