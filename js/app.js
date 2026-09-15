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
        translatepdf: $('#translatePdfPanel'),
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

    const addMoreFileImg = $('#addMoreFileImg');
    const addMoreInputImg = $('#addMoreInputImg');
    if (addMoreFileImg && addMoreInputImg) {
        addMoreFileImg.addEventListener('click', () => {
            addMoreInputImg.value = '';
            addMoreInputImg.click();
        });
        addMoreInputImg.addEventListener('change', (e) => {
            if (e.target.files.length) handleImageFiles(Array.from(e.target.files));
        });
    }

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

    const addMoreFileMerge = $('#addMoreFileMerge');
    const addMoreInputMerge = $('#addMoreInputMerge');
    if (addMoreFileMerge && addMoreInputMerge) {
        addMoreFileMerge.addEventListener('click', () => {
            addMoreInputMerge.value = '';
            addMoreInputMerge.click();
        });
        addMoreInputMerge.addEventListener('change', (e) => {
            if (e.target.files.length) handleMergeFiles(Array.from(e.target.files));
        });
    }

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

    const addMoreFileRename = $('#addMoreFileRename');
    const addMoreInputRename = $('#addMoreInputRename');
    if (addMoreFileRename && addMoreInputRename) {
        addMoreFileRename.addEventListener('click', () => {
            addMoreInputRename.value = '';
            addMoreInputRename.click();
        });
        addMoreInputRename.addEventListener('change', (e) => {
            if (e.target.files.length) handleRenameFiles(Array.from(e.target.files));
        });
    }

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
    function renderSimpleQueue(container, files, iconColor, onDelete, metaFn) {
        container.innerHTML = '';
        files.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'queue-item';
            div.dataset.id = item.id;
            const meta = metaFn ? metaFn(item) : null;
            div.innerHTML = `
                <div class="queue-thumb" style="display:flex;align-items:center;justify-content:center;color:${iconColor};">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                </div>
                <div class="queue-name-wrap">
                    <span class="queue-name" title="${item.file.name}">${item.file.name}</span>
                    ${meta ? `<span class="queue-sub${meta.warn ? ' warn' : ''}">${meta.text}</span>` : ''}
                </div>
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

    const addMoreFileW2P = $('#addMoreFileW2P');
    const addMoreInputW2P = $('#addMoreInputW2P');
    if (addMoreFileW2P && addMoreInputW2P) {
        addMoreFileW2P.addEventListener('click', () => {
            addMoreInputW2P.value = '';
            addMoreInputW2P.click();
        });
        addMoreInputW2P.addEventListener('change', (e) => {
            if (e.target.files.length) handleW2PFiles(Array.from(e.target.files));
        });
    }

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

    const addMoreFileP2W = $('#addMoreFileP2W');
    const addMoreInputP2W = $('#addMoreInputP2W');
    if (addMoreFileP2W && addMoreInputP2W) {
        addMoreFileP2W.addEventListener('click', () => {
            addMoreInputP2W.value = '';
            addMoreInputP2W.click();
        });
        addMoreInputP2W.addEventListener('change', (e) => {
            if (e.target.files.length) handleP2WFiles(Array.from(e.target.files));
        });
    }

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

    // ============================================================
    // ==================== MOTOR DE TRADUCCIÓN ====================
    // ============================================================
    // Extrae el texto del PDF con PDF.js y lo traduce mediante APIs
    // gratuitas de traducción con failover automático:
    //   1) Google Translate (endpoint público gtx)
    //   2) MyMemory API (respaldo)
    // Incluye caché de segmentos, deduplicación, reintentos con
    // backoff y detección de idioma (online + heurística offline).

    const TR_LANG_NAMES = {
        'es': 'Español', 'en': 'Inglés', 'fr': 'Francés', 'de': 'Alemán',
        'it': 'Italiano', 'pt': 'Portugués', 'ca': 'Catalán', 'gl': 'Gallego',
        'eu': 'Euskera', 'nl': 'Neerlandés', 'ru': 'Ruso', 'uk': 'Ucraniano',
        'pl': 'Polaco', 'ro': 'Rumano', 'tr': 'Turco', 'sv': 'Sueco',
        'zh-CN': 'Chino', 'ja': 'Japonés', 'ko': 'Coreano', 'ar': 'Árabe',
        'hi': 'Hindi'
    };
    const TR_CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F]/;
    const trCache = new Map();        // "sl|tl|segmento" → traducción (persistente)
    let trProvider = 'google';        // proveedor preferente (sticky)
    let trFailedSegments = 0;         // segmentos que conservaron el original

    // ===== Configuración del traductor =====
    const TR_MAX_FILE_MB = 50;                          // peso máximo por PDF (MB)
    const TR_MAX_FILE_BYTES = TR_MAX_FILE_MB * 1024 * 1024;
    const TR_PROXY_URL = 'https://pd-fto-png.vercel.app/api/translate'; // proxy propio desplegado en Vercel (api/translate.js en la raíz del repo). Déjalo en '' para usar solo servicios públicos
    const TR_BATCH_MAX = 8;                             // párrafos máximo por petición (lote)
    const TR_CONSEC_FAILS_STOP = 5;                     // fallos consecutivos antes de cortar el documento
    const TR_CACHE_KEY = 'pdftools_trcache_v1';
    const TR_CACHE_MAX_CHARS = 2500000;                 // ~2.5 MB en localStorage

    function trSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // fetch con tiempo límite (evita cuelgues de servicios caídos)
    function trFetch(url, opts, ms) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ms || 12000);
        return fetch(url, opts).finally(() => clearTimeout(t));
    }

    // ===== Caché persistente: reanuda traducciones interrumpidas =====
    (function trCacheLoad() {
        try {
            const raw = localStorage.getItem(TR_CACHE_KEY);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) arr.forEach(p => { if (p && p[0]) trCache.set(p[0], p[1]); });
            }
        } catch (e) { /* almacenamiento no disponible */ }
    })();
    let trSaveTimer = null;
    function trCachePersist() {
        if (!trCache.size) return;   // nunca borre entradas existentes con un Map vacío
        try {
            // Fusiona con lo ya almacenado (otras pestañas no pierden sus entradas)
            try {
                const prev = JSON.parse(localStorage.getItem(TR_CACHE_KEY) || '[]');
                if (Array.isArray(prev)) prev.forEach(p => {
                    if (p && p[0] && typeof p[1] === 'string' && !trCache.has(p[0])) trCache.set(p[0], p[1]);
                });
            } catch (e) { /* entrada corrupta: se ignora */ }
            let arr = Array.from(trCache.entries());
            let json = JSON.stringify(arr);
            while (json.length > TR_CACHE_MAX_CHARS && arr.length > 16) {
                arr = arr.slice(Math.floor(arr.length / 4));   // descarta los más antiguos
                json = JSON.stringify(arr);
            }
            localStorage.setItem(TR_CACHE_KEY, json);
        } catch (e) { /* almacenamiento lleno o bloqueado */ }
    }
    function trCacheScheduleSave() {
        clearTimeout(trSaveTimer);
        trSaveTimer = setTimeout(trCachePersist, 4000);
    }
    window.addEventListener('pagehide', () => trCachePersist());

    function trWords(s) {
        if (TR_CJK_RE.test(s)) return Math.max(1, Math.round(s.length / 2));
        return s.split(/\s+/).filter(Boolean).length;
    }

    // Divide un texto largo en trozos <= maxLen respetando párrafos,
    // frases y palabras (sin lookbehind, compatible con Safari antiguo)
    function trChunkText(text, maxLen) {
        if (text.length <= maxLen) return [text];
        const chunks = [];
        let buf = '';
        const flush = () => { if (buf.trim()) chunks.push(buf.trim()); buf = ''; };
        const lines = text.match(/[^\n]+(?:\n|$)|\n+/g) || [text];
        for (let line of lines) {
            while (buf && (buf + line).length > maxLen) flush();
            if (line.length > maxLen) {
                const sentences = line.match(/[^.!?…。！？]+[.!?…。！？]*\s*/g) || [line];
                for (let s of sentences) {
                    while (buf && (buf + s).length > maxLen) flush();
                    if (s.length > maxLen) {
                        const words = s.split(/(\s+)/);
                        for (let w of words) {
                            while (buf && (buf + w).length > maxLen) flush();
                            if (w.length > maxLen) {
                                for (let i = 0; i < w.length; i += maxLen) chunks.push(w.slice(i, i + maxLen));
                            } else buf += w;
                        }
                    } else buf += s;
                }
            } else buf += line;
        }
        flush();
        return chunks.length ? chunks : [text.slice(0, maxLen)];
    }

    // Proveedor 1: Google Translate (endpoint público, con autodetección)
    async function trGoogle(text, sl, tl) {
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t'
            + '&sl=' + encodeURIComponent(sl) + '&tl=' + encodeURIComponent(tl)
            + '&q=' + encodeURIComponent(text);
        const res = await trFetch(url);
        if (!res.ok) throw new Error('google-http-' + res.status);
        const data = await res.json();
        if (!data || !Array.isArray(data[0])) throw new Error('google-formato');
        let out = '';
        data[0].forEach(seg => { if (seg && typeof seg[0] === 'string') out += seg[0]; });
        if (!out.trim()) throw new Error('google-vacio');
        return { text: out, detected: (typeof data[2] === 'string' && data[2]) ? data[2] : null };
    }

    // Proveedor 2: MyMemory (respaldo gratuito, límite ~500 caracteres)
    async function trMyMemory(text, sl, tl) {
        const src = (sl && sl !== 'auto') ? sl : 'en';
        const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text)
            + '&langpair=' + encodeURIComponent(src + '|' + tl);
        const res = await trFetch(url);
        if (!res.ok) throw new Error('mymemory-http-' + res.status);
        const data = await res.json();
        const t = data && data.responseData && data.responseData.translatedText;
        if (!t || /QUERY LENGTH LIMIT|INVALID|QUOTA/i.test(t)) throw new Error('mymemory-rechazo');
        return { text: t, detected: null };
    }

    // Proveedor 0 (opcional): proxy propio desplegado en Vercel (gratis)
    async function trProxy(text, sl, tl) {
        const res = await trFetch(TR_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, sl: sl, tl: tl })
        }, 20000);
        if (!res.ok) throw new Error('proxy-http-' + res.status);
        const data = await res.json();
        if (!data || !data.text) throw new Error('proxy-formato');
        return { text: data.text, detected: data.detected || null };
    }

    // Proveedor extra: endpoint de Google usado por extensiones (muy permisivo)
    async function trGoogleChrome(text, sl, tl) {
        const url = 'https://clients5.google.com/translate_a/t?client=dict-chrome-ex'
            + '&sl=' + encodeURIComponent(sl === 'auto' ? 'auto' : sl)
            + '&tl=' + encodeURIComponent(tl)
            + '&q=' + encodeURIComponent(text);
        const res = await trFetch(url);
        if (!res.ok) throw new Error('gchrome-http-' + res.status);
        const data = await res.json();
        if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('gchrome-formato');
        let out = '';
        data[0].forEach(seg => {
            if (typeof seg === 'string') out += seg;
            else if (Array.isArray(seg) && typeof seg[0] === 'string') out += seg[0];
        });
        if (!out.trim()) throw new Error('gchrome-vacio');
        return { text: out, detected: null };
    }

    // Proveedor extra: Lingva (frontend libre de Google Translate, sin clave)
    const TR_LINGVA_HOSTS = ['https://lingva.lunar.icu', 'https://lingva.ml'];
    async function trLingva(text, sl, tl) {
        let lastErr = null;
        for (const host of TR_LINGVA_HOSTS) {
            try {
                const url = host + '/api/v1/' + encodeURIComponent(sl === 'auto' ? 'auto' : sl)
                    + '/' + encodeURIComponent(tl) + '/' + encodeURIComponent(text);
                const res = await trFetch(url, null, 9000);
                if (!res.ok) throw new Error('lingva-http-' + res.status);
                const data = await res.json();
                if (!data || !data.translation) throw new Error('lingva-vacio');
                return { text: data.translation, detected: null };
            } catch (e) { lastErr = e; }
        }
        throw lastErr || new Error('lingva-fallo');
    }

    // Detecta el idioma de una muestra: online, con heurística offline de respaldo
    async function trDetect(sample) {
        const short = sample.slice(0, 400);
        try {
            const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t'
                + '&sl=auto&tl=en&q=' + encodeURIComponent(short);
            const res = await trFetch(url, null, 8000);
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data[2] === 'string' && data[2]) return data[2];
            }
        } catch (e) { /* usar heurística */ }
        return trDetectHeuristic(sample);
    }

    function trDetectHeuristic(text) {
        const t = text.slice(0, 1500);
        if (/[\u3040-\u30FF]/.test(t)) return 'ja';
        if (/[\uAC00-\uD7AF]/.test(t)) return 'ko';
        if (/[\u4E00-\u9FFF]/.test(t)) return 'zh-CN';
        if (/[\u0600-\u06FF]/.test(t)) return 'ar';
        if (/[\u0900-\u097F]/.test(t)) return 'hi';
        if (/[\u0400-\u04FF]/.test(t)) return /[їієґ]/i.test(t) ? 'uk' : 'ru';
        if (/[\u0370-\u03FF]/.test(t)) return 'el';
        const lower = ' ' + t.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ') + ' ';
        const score = (words) => words.reduce((acc, w) => acc + (lower.includes(' ' + w + ' ') ? 1 : 0), 0);
        const counts = [
            ['es', score(['el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'por', 'con', 'para', 'es', 'del', 'se', 'no', 'su', 'al'])],
            ['en', score(['the', 'of', 'and', 'to', 'in', 'is', 'that', 'for', 'it', 'with', 'as', 'was', 'on', 'are', 'this', 'be', 'have', 'from'])],
            ['fr', score(['le', 'la', 'les', 'des', 'et', 'est', 'un', 'une', 'du', 'que', 'pour', 'dans', 'sur', 'pas', 'au', 'ce', 'il'])],
            ['pt', score(['os', 'as', 'de', 'que', 'um', 'uma', 'do', 'da', 'em', 'para', 'com', 'não', 'por', 'mais', 'como'])],
            ['it', score(['il', 'di', 'che', 'un', 'una', 'del', 'della', 'per', 'con', 'non', 'sono', 'come', 'anche'])],
            ['de', score(['der', 'die', 'das', 'und', 'ist', 'von', 'zu', 'den', 'mit', 'nicht', 'ein', 'eine', 'auf', 'für', 'im', 'sich'])],
            ['ca', score(['els', 'les', 'dels', 'és', 'amb', 'per', 'com', 'més', 'que', 'un', 'una'])],
            ['gl', score(['os', 'as', 'do', 'da', 'unha', 'que', 'para', 'con', 'non', 'como', 'mais'])],
            ['nl', score(['het', 'een', 'en', 'van', 'is', 'dat', 'niet', 'met', 'voor', 'op', 'zijn', 'aan', 'ook'])],
            ['tr', score(['bir', 've', 'bu', 'için', 'ile', 'olarak', 'daha', 'çok', 'var', 'ama', 'gibi', 'olan'])]
        ];
        counts.sort((a, b) => b[1] - a[1]);
        return counts[0][1] > 0 ? counts[0][0] : 'en';
    }

    // Registro de proveedores: límite de caracteres por petición y pausa
    // adaptativa (se duplica ante 429/cuota y decae tras cada éxito).
    const TR_PROVIDERS = {};
    if (TR_PROXY_URL) TR_PROVIDERS.proxy = { limit: 4500, pause0: 120, fn: trProxy };
    TR_PROVIDERS.google = { limit: 1200, pause0: 150, fn: trGoogle };
    TR_PROVIDERS.gchrome = { limit: 1000, pause0: 150, fn: trGoogleChrome };
    TR_PROVIDERS.lingva = { limit: 1200, pause0: 220, fn: trLingva };
    TR_PROVIDERS.mymemory = { limit: 460, pause0: 260, fn: trMyMemory };

    const trPauses = {};
    function trOrder() {
        const names = Object.keys(TR_PROVIDERS);
        if (trProvider && TR_PROVIDERS[trProvider]) {
            return [trProvider].concat(names.filter(n => n !== trProvider));
        }
        return names;
    }
    function trIsQuotaError(err) {
        return /http-429|http-5\d\d|QUOTA|LIMIT|rechazo/i.test(String((err && err.message) || err));
    }

    // Traduce UN texto (ya dentro del límite del proveedor) recorriendo la
    // cadena de proveedores con 2 reintentos y pausa adaptativa cada uno.
    async function trTranslateRaw(text, sl, tl) {
        let lastErr = null;
        for (const prov of trOrder()) {
            const P = TR_PROVIDERS[prov];
            if (text.length > P.limit) continue;    // este proveedor no admite textos tan largos
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const out = await P.fn(text, sl, tl);
                    if (!out || !out.text) throw new Error('respuesta-vacía');
                    trProvider = prov;
                    trPauses[prov] = Math.max(P.pause0, Math.round((trPauses[prov] || P.pause0) * 0.85));
                    return out;
                } catch (err) {
                    lastErr = err;
                    if (trIsQuotaError(err)) trPauses[prov] = Math.min((trPauses[prov] || P.pause0) * 2, 8000);
                    await trSleep(400 + 500 * attempt);
                }
            }
        }
        throw lastErr || new Error('sin-proveedor');
    }

    // Traduce un segmento (párrafo) usando el proveedor preferente y,
    // si falla, los alternativos; con caché, troceado automático y pausa adaptativa.
    async function trTranslateSegment(text, sl, tl) {
        const key = sl + '|' + tl + '|' + text;
        if (trCache.has(key)) return trCache.get(key);

        let lastErr = null;
        for (const prov of trOrder()) {
            const P = TR_PROVIDERS[prov];
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const parts = trChunkText(text, P.limit);
                    const outParts = [];
                    for (const part of parts) {
                        const out = await P.fn(part, sl, tl);
                        if (!out || !out.text) throw new Error('respuesta-vacía');
                        outParts.push(out.text);
                        await trSleep(Math.min(trPauses[prov] || P.pause0, 1500));
                    }
                    trProvider = prov;
                    trPauses[prov] = Math.max(P.pause0, Math.round((trPauses[prov] || P.pause0) * 0.85));
                    const joined = outParts.join(' ');
                    trCache.set(key, joined);
                    trCacheScheduleSave();
                    return joined;
                } catch (err) {
                    lastErr = err;
                    if (trIsQuotaError(err)) trPauses[prov] = Math.min((trPauses[prov] || P.pause0) * 2, 8000);
                    await trSleep(600 * (attempt + 1));
                }
            }
        }
        throw lastErr || new Error('No se pudo traducir el segmento');
    }

    // Extrae el texto de un PDF organizado en páginas y párrafos.
    // Reutiliza groupTextItemsIntoLines (mismo motor que PDF → Word).
    function trLineText(line) {
        let out = '';
        let prev = null;
        line.items.forEach(it => {
            let s = it.str;
            if (prev) {
                const gap = it.x - (prev.x + prev.width);
                if (gap > prev.height * 0.15 && !/^\s/.test(s) && !/\s$/.test(prev.str)) out += ' ';
            }
            out += s;
            prev = it;
        });
        return out.replace(/\s+/g, ' ').trim();
    }

    // Geometría de un párrafo a partir de sus líneas (coordenadas PDF,
    // origen abajo-izquierda, mismas que usa pdf-lib).
    function buildParaGeo(ls) {
        if (!ls.length) return null;
        const n = ls.length;
        const x0 = Math.min.apply(null, ls.map(l => l.x));
        const x1 = Math.max.apply(null, ls.map(l => l.x + l.w));
        const sizes = ls.map(l => l.h).slice().sort((a, b) => a - b);
        const size = sizes[Math.floor(sizes.length / 2)] || 10;
        const yTop = Math.max.apply(null, ls.map(l => l.y));
        const yBot = Math.min.apply(null, ls.map(l => l.y));
        const bold = ls.filter(l => l.bold).length * 2 >= n;
        const italic = ls.filter(l => l.italic).length * 2 >= n;
        const leading = n > 1 ? (yTop - yBot) / (n - 1) : size * 1.3;
        return { x0: x0, x1: x1, yTop: yTop, yBot: yBot, size: size,
            leading: Math.max(leading, size * 1.05), bold: bold, italic: italic, n: n };
    }

    // Divide una línea en celdas según huecos internos grandes (tablas,
    // índices con puntos, maquetas multi-columna). Un hueco mayor que el
    // cuerpo de la fuente casi nunca es un espacio de palabra normal.
    function splitLineIntoCells(line) {
        const cells = [];
        let cur = null;
        line.items.forEach(it => {
            const h = it.height || line.avgHeight || 10;
            const blank = !/\S/.test(it.str);
            const w = it.width || 0;
            // Un espacio en blanco anormalmente ancho separa columnas de
            // tabla/índice: cierra la celda actual (gap real oculto tras él).
            if (blank && w > Math.max(h * 1.2, 9)) { cur = null; return; }
            const gap = cur ? it.x - cur.x1 : Infinity;
            if (cur && gap <= Math.max(h * 0.95, 7)) {
                if (gap > h * 0.15 && !/^\s/.test(it.str) && !/\s$/.test(cur.text)) cur.text += ' ';
                cur.text += it.str;
                cur.x1 = it.x + it.width;
                if (h > cur.h) cur.h = h;
                const f = (it.fontName || '').toLowerCase();
                if (f.indexOf('bold') !== -1) cur.bold = true;
                if (f.indexOf('italic') !== -1 || f.indexOf('oblique') !== -1) cur.ital = true;
            } else if (blank) {
                return;   // espacio suelto fuera de celda
            } else {
                const f = (it.fontName || '').toLowerCase();
                cur = { text: it.str, x0: it.x, x1: it.x + it.width, h: h,
                    bold: f.indexOf('bold') !== -1,
                    ital: f.indexOf('italic') !== -1 || f.indexOf('oblique') !== -1 };
                cells.push(cur);
            }
        });
        return cells;
    }

    async function trExtractPdf(file, onProgress) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = [];
        let totalChars = 0;
        const pageChars = [];   // caracteres por página (detecta páginas escaneadas)

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const lines = groupTextItemsIntoLines(textContent.items);

            const paragraphs = [];
            const geoList = [];
            let buf = '';
            let bufLines = [];
            let prevY = null;

            const pushPara = () => {
                if (buf.trim()) {
                    paragraphs.push(buf.trim());
                    geoList.push(buildParaGeo(bufLines));
                }
                buf = '';
                bufLines = [];
            };

            lines.forEach(line => {
                const cells = splitLineIntoCells(line);
                const text = trLineText(line);
                if (prevY !== null && (prevY - line.y) > line.avgHeight * 1.9) {
                    pushPara();
                }
                if (text && cells.length >= 2) {
                    // fila tipo tabla/índice: cada celda es su propio párrafo
                    pushPara();
                    cells.forEach(c => {
                        const t = c.text.replace(/\s+/g, ' ').trim();
                        if (!t) return;
                        paragraphs.push(t);
                        geoList.push({
                            x0: c.x0, x1: c.x1, yTop: line.y, yBot: line.y,
                            size: c.h, leading: c.h * 1.3, bold: c.bold, italic: c.ital, n: 1
                        });
                    });
                    buf = '';
                    bufLines = [];
                } else if (text) {
                    // reconstruir palabras cortadas por guion al final de línea
                    if (buf.endsWith('-') && /^[a-záéíóúñüàèìòùâêîôûäëïöçãõ]./.test(text)) {
                        buf = buf.replace(/-$/, '') + text;
                    } else {
                        buf = buf ? buf + ' ' + text : text;
                    }
                    // geometría de la línea (posición, ancho, negrita/cursiva)
                    let lx0 = Infinity, lx1 = -Infinity, lBold = false, lItal = false;
                    line.items.forEach(it => {
                        const f = (it.fontName || '').toLowerCase();
                        if (it.x < lx0) lx0 = it.x;
                        if (it.x + it.width > lx1) lx1 = it.x + it.width;
                        if (f.indexOf('bold') !== -1) lBold = true;
                        if (f.indexOf('italic') !== -1 || f.indexOf('oblique') !== -1) lItal = true;
                    });
                    if (lx1 > -Infinity) {
                        bufLines.push({ x: lx0, y: line.y, w: lx1 - lx0, h: line.avgHeight, bold: lBold, italic: lItal });
                    }
                } else if (buf.trim()) {
                    pushPara();
                }
                prevY = line.y;
            });
            pushPara();

            let chars = 0;
            paragraphs.forEach(p => { totalChars += p.length; chars += (p.match(/\S/g) || []).length; });
            pageChars.push(chars);
            pages.push({ paragraphs: paragraphs, geo: geoList });
            if (onProgress) onProgress(pageNum / pdf.numPages);
        }

        return { pages: pages, hasText: totalChars >= 20, pageChars: pageChars };
    }

    // ===== OCR integrado (Tesseract.js) para páginas escaneadas =====
    // Si una página no tiene capa de texto (o el usuario fuerza OCR),
    // se renderiza a imagen y Tesseract lee el texto CON su posición.
    // El resultado se convierte al MISMO formato párrafos+geometría que
    // la extracción digital: todo el pipeline (lotes, caché, corte
    // parcial, PDF diseño, bilingüe…) funciona sin cambios.

    const TR_OCR_MIN_CHARS = 40;   // menos caracteres por página ⇒ escaneada
    const TR_OCR_SECS_PAGE = 10;   // estimación s/página (para la ETA; render fino + preproceso)
    const TR_OCR_MAX_LINES_PARA = 8;  // parte párrafos gigantes (columnas)
    const TR_OCR_MIN_WORD_CONF = 68;  // confianza mínima de palabra: los disparates del LSTM
                                      // ("abe Te", "Nee was vided") quedan casi siempre por
                                      // debajo de 68; con el preproceso de contraste las
                                      // palabras reales suben a 75-95. Ante la duda, fuera.

    // Detecta líneas OCR que son RUIDO leído sobre ilustraciones, capturas
    // de pantalla, filigranas o fuentes decorativas (el caso típico: libros
    // ilustrados). Criterios: proporción de letras, proporción de vocales
    // (todo idioma real ronda 30-45 %), palabras sin vocales, letras sueltas
    // y mezclas implausibles de mayúsculas y dígitos. Ante la duda se
    // descarta: mejor queda una zona sin traducir que una caja de basura
    // tapando el diseño.
    function trOcrLineIsGarbage(text) {
        const VOW = /[aeiou\u00E0-\u00FC\u03B1\u03B5\u03B7\u03B9\u03BF\u03C5\u03C9\u0430\u0435\u0438\u043E\u0443\u044B\u044F\u0451]/;
        const t = String(text || '').replace(/\s+/g, ' ').trim();
        if (t.length < 3) return true;
        let letters = 0, weird = 0, nonspace = 0;
        for (const ch of t) {
            if (/\s/.test(ch)) continue;
            nonspace++;
            if (/[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/.test(ch)) letters++;
            else if (!/[0-9.,;:!?\u00A1\u00BF'"()\-\u2013\u2014&%\u20AC\u00A3\u00AB\u00BB\u2026]/.test(ch)) weird++;
        }
        if (!nonspace) return true;
        if (letters / nonspace < 0.55) return true;        // demasiado símbolo/número
        if (weird >= 3 && weird / nonspace > 0.08) return true;
        const low = t.toLowerCase();
        let vow = 0, onlyLetters = 0;
        for (const ch of low) {
            if (/[a-z\u00E0-\u00FC\u03B1-\u03C9\u0430-\u044F]/.test(ch)) {
                onlyLetters++;
                if (VOW.test(ch)) vow++;
            }
        }
        if (onlyLetters >= 8 && vow / onlyLetters < 0.2) return true;   // p. ej. «NIN DET TRZS»
        const words = t.split(/\s+/);
        let bad = 0, real = 0;
        words.forEach(w => {
            const wl = w.toLowerCase().replace(/[^a-z\u00E0-\u00FC\u03B1-\u03C9\u0430-\u044F]/g, '');
            if (wl.length >= 2 && !VOW.test(wl)) { bad++; return; }   // racimos sin vocales: RL, ZA, TRZS
            if (wl.length === 1 && !'aeiou\u00E1\u00E9\u00ED\u00F3\u00FAy'.includes(wl) && !/\d/.test(w)) { bad++; return; }
            real++;
        });
        if (real === 0) return true;
        if (words.length >= 2 && bad / words.length > 0.26) return true;   // 1 de cada 4 palabras sin vocales ya es sospechoso
        if (words.length === 1 && bad === 1) return true;
        const caps = words.filter(w => /^[A-Z\u00C0-\u00DE0-9]{1,3}$/.test(w)).length;
        if (words.length >= 4 && caps / words.length > 0.5) return true;   // «A 4 Mar M7 ZA 7»
        return false;
    }

    // Línea CORTA, toda EN MAYÚSCULAS (1-3 tokens de ≤ 4 caracteres) y con
    // confianza mediocre: casi siempre son rótulos falsos leídos sobre una
    // ilustración («ZA NIN», «M7 RL»). Los rótulos verdaderos de una maqueta
    // se leen con confianza ≥ 85; ante la duda se descarta la línea.
    function trOcrLineIsSuspect(l) {
        if (!l || l.conf == null || l.conf >= 82) return false;
        const ws = String(l.text || '').split(/\s+/);
        if (ws.length > 3) return false;
        return ws.every(w => /^[A-Z\u00C0-\u00DE0-9]{1,4}$/.test(w));
    }
    let trOcrLibPromise = null;    // descarga única de Tesseract.js
    const trOcrWorkers = new Map(); // idioma → worker reutilizable
    let trOcrStatusCb = null;      // callback de progreso del motor

    function trOcrMode() {
        const el = document.getElementById('trOcrMode');
        return el ? el.value : 'auto';
    }
    function trOcrLang() {
        const el = document.getElementById('trOcrLang');
        return el ? el.value : 'eng+spa';
    }

    function trLoadOcrLib() {
        if (window.Tesseract) return Promise.resolve();
        if (trOcrLibPromise) return trOcrLibPromise;
        trOcrLibPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            s.onload = () => resolve();
            s.onerror = () => {
                trOcrLibPromise = null;
                reject(new Error('no se pudo descargar el motor OCR (Tesseract.js) — revisa tu conexión'));
            };
            document.head.appendChild(s);
        });
        return trOcrLibPromise;
    }

    async function trOcrWorker(lang) {
        if (trOcrWorkers.has(lang)) return trOcrWorkers.get(lang);
        await trLoadOcrLib();
        const opts = {
            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5',
            langPath: 'https://tessdata.projectnaptha.com/4.0.0',
            logger: (m) => { if (trOcrStatusCb) trOcrStatusCb(m); }
        };
        let worker;
        try {
            worker = await Tesseract.createWorker(lang, 1, opts);          // API v5
        } catch (e1) {
            try { worker = await Tesseract.createWorker(Object.assign({ lang: lang, oem: 1 }, opts)); } // API v4
            catch (e2) {
                throw new Error('no se pudo iniciar el OCR: ' + ((e2 && e2.message) || (e1 && e1.message) || 'error desconocido'));
            }
        }
        try {
            await worker.setParameters({
                preserve_interword_spaces: '1',
                user_defined_dpi: '300'   // el canvas no declara DPI; sin esto Tesseract asume ~70 y lee peor
            });
        } catch (e) { /* opcional */ }
        trOcrWorkers.set(lang, worker);
        return worker;
    }

    function trOcrTerminate() {
        trOcrWorkers.forEach(w => { try { w.terminate(); } catch (e) {} });
        trOcrWorkers.clear();
    }

    // Fusiona la página digital (texto real del PDF) con la página OCR:
    // el texto digital se conserva SIEMPRE intacto y solo se añaden los
    // bloques OCR que no solapen con él. Así «Siempre OCR» completa las
    // zonas sin detectar sin degradar el texto que ya era bueno, y en
    // modo automático las páginas casi vacías no pierden sus restos de
    // texto real (números de página, pies…).
    function trMergeOcrPage(digPg, ocrPg) {
        const digGeos = (digPg && digPg.geo) || [];
        const digTexts = (digPg && digPg.paragraphs) || [];
        const out = { paragraphs: digTexts.slice(), geo: digGeos.slice(), ocrDone: true };
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9áéíóúüñàèìòùâêîôûäëïöçãõ]/g, '');
        (ocrPg.paragraphs || []).forEach((t, i) => {
            const g = ocrPg.geo && ocrPg.geo[i];
            if (!g || !t) return;
            const nt = norm(t);
            if (nt.length > 15 && digTexts.some(d => norm(d) === nt)) return;   // ya está leído digitalmente
            const ga = Math.max((g.x1 - g.x0) * (g.yTop - g.yBot), 1);
            const overlaps = digGeos.some(dg => {
                if (!dg) return false;
                const ox = Math.min(dg.x1, g.x1) - Math.max(dg.x0, g.x0);
                const oy = Math.min(dg.yTop, g.yTop) - Math.max(dg.yBot, g.yBot);
                if (ox <= 2 || oy <= 2) return false;
                return (ox * oy) / ga > 0.35;   // el bloque digital ya cubre esa zona
            });
            if (!overlaps) { out.paragraphs.push(t); out.geo.push(g); }
        });
        return out;
    }

    // Reconstruye párrafos desde la salida de Tesseract. Importante: no se
    // confía en las líneas/párrafos del LSTM (fusiona columnas, salta en
    // maquetas complejas): se reconstruye todo desde las PALABRAS (bbox
    // individual, siempre disponibles) en 4 pasos:
    //   1) FILAS por solape vertical (inmune al jitter de ±px en y0 del OCR;
    //      ordenar por (y0,x0) y agrupar en secuencia ENTRELAZA columnas)
    //   2) cada fila → SEGMENTOS cortando en huecos horizontales grandes
    //      (columna vecina, recuadro del flujo-grama, ilustración…)
    //   3) limpieza de palabras-ruido y descarte de segmentos-basura
    //   4) PÁRRAFOS por proximidad GLOBAL: cada segmento se engancha al
    //      bloque superior con solape horizontal y alineación reales
    // Devuelve [[{text, bbox}, …], …] — grupos de líneas en píxeles canvas.
    function trOcrParagraphsFromData(data) {
        // Prefer complete native lines and paragraph boundaries. Never remove
        // uncertain words from an otherwise reliable sentence.
        if (Array.isArray(data.blocks) && data.blocks.some(b => (b.paragraphs || []).length)) {
            const groups = [];
            for (const block of data.blocks) {
                for (const para of block.paragraphs || []) {
                    let group = [];
                    const flush = () => { if (group.length) groups.push(group); group = []; };
                    for (const line of para.lines || []) {
                        const words = (line.words || []).filter(w => w.bbox && String(w.text || '').trim());
                        const text = (words.length ? words.map(w => w.text).join(' ') : String(line.text || '')).replace(/\s+/g, ' ').trim();
                        const bbox = line.bbox;
                        const known = words.filter(w => Number.isFinite(w.confidence));
                        const conf = known.length ? known.reduce((n, w) => n + w.confidence * w.text.length, 0) /
                            known.reduce((n, w) => n + w.text.length, 0) : line.confidence;
                        if (!bbox || bbox.x1 <= bbox.x0 || bbox.y1 <= bbox.y0 ||
                            !/[\p{L}\p{N}]/u.test(text) || (Number.isFinite(conf) && conf < 55)) {
                            flush(); continue;
                        }
                        // Split large internal gutters without discarding any tokens.
                        const parts = [];
                        for (const word of words) {
                            const last = parts[parts.length - 1];
                            if (!last || word.bbox.x0 - last[last.length - 1].bbox.x1 > (bbox.y1 - bbox.y0) * 2.5)
                                parts.push([word]);
                            else last.push(word);
                        }
                        if (parts.length > 1) {
                            flush();
                            for (const part of parts) groups.push([{
                                text: part.map(w => w.text).join(' '), conf,
                                bbox: { x0: Math.min(...part.map(w => w.bbox.x0)), x1: Math.max(...part.map(w => w.bbox.x1)),
                                    y0: Math.min(...part.map(w => w.bbox.y0)), y1: Math.max(...part.map(w => w.bbox.y1)) }
                            }]);
                        } else group.push({ text, bbox, conf });
                    }
                    flush();
                }
            }
            return groups;
        }
        // 1) aplana palabras (v5: blocks→paragraphs→lines→words; legacy: data.words)
        const raw = [];
        const takeWord = (w) => {
            if (!w || !w.bbox) return;
            const t = String(w.text || '').replace(/\s+/g, ' ').trim();
            if (!t) return;
            if (w.confidence != null && w.confidence < TR_OCR_MIN_WORD_CONF) return;   // ruido de ilustraciones
            if (/^[\W_]+$/.test(t) && !/\d/.test(t)) return;   // solo símbolos (·, |, ==(, '()…)
            if (w.bbox.y1 - w.bbox.y0 < 5) return;             // mota/polvo más pequeño que cualquier texto
            raw.push({ text: t, bbox: w.bbox, conf: (w.confidence != null) ? w.confidence : null });
        };
        if (Array.isArray(data.blocks) && data.blocks.length) {
            data.blocks.forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => (l.words || []).forEach(takeWord))));
        }
        if (!raw.length && Array.isArray(data.words)) data.words.forEach(takeWord);
        if (!raw.length && Array.isArray(data.lines)) {
            // último recurso (v4 sin words): usa las líneas como unidades
            data.lines.forEach(l => {
                if (!l || !l.bbox) return;
                const t = String(l.text || '').replace(/\s+/g, ' ').trim();
                if (!t || t.length < 2) return;
                if (l.confidence != null && l.confidence < 50) return;
                if (/^[\W_]+$/.test(t) && !/\d/.test(t)) return;
                if (trOcrLineIsGarbage(t)) return;
                raw.push({ text: t, bbox: l.bbox, conf: (l.confidence != null) ? l.confidence : null });
            });
        }
        if (!raw.length) return [];

        const hs = raw.map(w => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
        const medH = Math.max(hs[Math.floor(hs.length / 2)] || 20, 8);
        const minX = Math.min.apply(null, raw.map(w => w.bbox.x0));
        const maxX = Math.max.apply(null, raw.map(w => w.bbox.x1));
        const contentW = Math.max(maxX - minX, 1);

        // palabras-fantasma: manchas, ornamentos o filigranas leídas como
        // «palabras» enormes de 1-3 caracteres (distorsionan la canaleta y
        // acaban creando cajas gigantes)
        for (let i = raw.length - 1; i >= 0; i--) {
            const w = raw[i];
            if ((w.bbox.x1 - w.bbox.x0) > contentW * 0.7 && w.text.replace(/\s/g, '').length <= 3) raw.splice(i, 1);
        }
        if (!raw.length) return [];

        // 2) FILAS por solape vertical (no por banda Y con media móvil):
        // el jitter de ±2-3 px en y0 del OCR real entrelaza columnas si se
        // ordena por (y0, x0) y se agrupa en secuencia. Aquí cada palabra se
        // une a la fila con la que comparte altura de verdad (solape ≥ 40 %
        // de la más baja de las dos): las filas son estables aunque y0 vibre.
        const rows = [];
        raw.forEach(w => {
            const wh = w.bbox.y1 - w.bbox.y0;
            let best = null, bestOv = 0;
            for (const r of rows) {
                const ov = Math.min(r.y1, w.bbox.y1) - Math.max(r.y0, w.bbox.y0);
                if (ov > bestOv) { bestOv = ov; best = r; }
            }
            if (best && bestOv >= Math.min(wh, best.h) * 0.4) {
                best.ws.push(w);
                best.y0 = Math.min(best.y0, w.bbox.y0);
                best.y1 = Math.max(best.y1, w.bbox.y1);
                best.h = best.y1 - best.y0;
            } else {
                rows.push({ y0: w.bbox.y0, y1: w.bbox.y1, h: wh, ws: [w] });
            }
        });
        rows.sort((a, b) => (a.y0 - b.y0) || (a.y1 - b.y1));

        // 3) cada fila → SEGMENTOS cortando en huecos horizontales grandes:
        // dos palabras separadas más de 1.5 × cuerpo casi nunca son del mismo
        // bloque (columna vecina, otro recuadro, una ilustración en medio).
        // Dentro de cada segmento se LIMPIAN las palabras-ruido individuales
        // (racimos sin vocales leídos sobre la ilustración que comparten
        // banda Y con texto real): el segmento se reconstruye solo con las
        // palabras fiables y su caja se recalcula con ellas.
        const VOW = /[aeiou\u00E0-\u00FC\u03B1\u03B5\u03B7\u03B9\u03BF\u03C5\u03C9\u0430\u0435\u0438\u043E\u0443\u044B\u044F\u0451]/;
        const wordIsNoise = (t, conf) => {
            const s = String(t || '');
            const wl = s.toLowerCase().replace(/[^a-z\u00E0-\u00FC\u03B1-\u03C9\u0430-\u044F]/g, '');
            if (!wl) return !/\d/.test(s);   // sin letras: ruido salvo números
            // «by», «my», «why», «gym»…: la y hace de vocal; un racimo sin
            // NINGUNA vocal real (RL, TRZS) sí es ruido
            if (wl.length >= 2 && !VOW.test(wl) && !/y/.test(wl)) return true;
            if (wl.length === 2 && !VOW.test(wl) && wl !== 'by' && wl !== 'my') return true;
            if (wl.length === 1 && !'aeiou\u00E1\u00E9\u00ED\u00F3\u00FAy'.includes(wl) && !/\d/.test(s)) return true;
            // token corto EN MAYÚSCULAS con confianza mediocre (p. ej. «NIN»,
            // «DET», «M7» leídos sobre una ilustración): casi nunca es texto
            // real; los rótulos verdaderos suelen leerse con confianza alta
            if (conf != null && conf < 72 && s.length <= 6 && !/[a-z\u00E0-\u00FC]/.test(s)
                && s.replace(/[^A-Za-z0-9\u00C0-\u00DE]/g, '').length >= 2) return true;
            return false;
        };
        const GUT_WORD = Math.max(medH * 1.5, 26);
        const segs = [];
        rows.forEach(r => {
            r.ws.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            let cur = null;
            r.ws.forEach(w => {
                if (cur && (w.bbox.x0 - cur.right) > GUT_WORD) cur = null;   // hueco → segmento nuevo
                if (!cur) { cur = { ws: [w], right: w.bbox.x1 }; segs.push(cur); }
                else { cur.ws.push(w); cur.right = Math.max(cur.right, w.bbox.x1); }
            });
        });

        // 4) segmento → línea limpia; descarte de basura y de rótulos
        // falsos en mayúsculas con confianza mediocre
        const lineObjs = segs.map(s => {
            s.ws.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            const clean = s.ws.filter(w => !wordIsNoise(w.text, w.conf));
            if (!clean.length) return null;   // el segmento era 100 % ruido
            return {
                text: clean.map(w => w.text).join(' '),
                conf: (clean.some(w => w.conf != null))
                    ? clean.reduce((acc, w) => acc + (w.conf != null ? w.conf : 0), 0) / clean.filter(w => w.conf != null).length
                    : null,
                bbox: {
                    x0: Math.min.apply(null, clean.map(w => w.bbox.x0)),
                    x1: Math.max.apply(null, clean.map(w => w.bbox.x1)),
                    y0: Math.min.apply(null, clean.map(w => w.bbox.y0)),
                    y1: Math.max.apply(null, clean.map(w => w.bbox.y1))
                }
            };
        }).filter(l => l && !trOcrLineIsGarbage(l.text) && !trOcrLineIsSuspect(l));
        if (!lineObjs.length) return [];

        // 5) párrafos por PROXIMIDAD GLOBAL (no en secuencia de proceso):
        // cada segmento se engancha al bloque anterior que quede JUSTO
        // encima con solape horizontal real (> 55 %) y bordes o centro
        // alineados. Así dos columnas que se alternan en Y NUNCA se fusionan
        // entre sí (no comparten solape X) y dos recuadros apilados del
        // flujo-grama quedan separados (el hueco vertical los distingue).
        lineObjs.sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));
        const paras = [];
        lineObjs.forEach(s => {
            const b = s.bbox;
            const sh = b.y1 - b.y0;   // altura del renglón (detecta saltos de cuerpo)
            let bestP = null, bestOv = 0;
            for (const P of paras) {
                const cb = P.box;
                const gap = b.y0 - cb.y1;
                // renglón siguiente: hasta ~1.35 × cuerpo (los bbox del OCR
                // miden ascender→descender; el interlineado deja huecos de
                // 0.3-1.2 × medH). Los recuadros vecinos quedan mucho más
                // lejos (bordes + margen) y no se fusionan.
                if (gap > medH * 1.35 || gap < -medH * 0.6) continue;
                // cuerpos muy distintos = cabecera + cuerpo o bloque nuevo:
                // un título grande jamás se funde con el párrafo que tiene debajo
                if (Math.min(sh, P.lastH) / Math.max(sh, P.lastH) < 0.68) continue;
                const ov = Math.min(cb.x1, b.x1) - Math.max(cb.x0, b.x0);
                const wMin = Math.min(cb.x1 - cb.x0, b.x1 - b.x0);
                if (ov <= wMin * 0.55) continue;
                const alinea = Math.abs(b.x0 - cb.x0) <= medH * 1.15 ||
                    Math.abs((b.x0 + b.x1) / 2 - (cb.x0 + cb.x1) / 2) <= medH * 1.15;
                if (!alinea) continue;
                if (ov > bestOv) { bestOv = ov; bestP = P; }
            }
            if (bestP) {
                bestP.lines.push(s);
                bestP.lastH = sh;
                bestP.box = { x0: Math.min(bestP.box.x0, b.x0), x1: Math.max(bestP.box.x1, b.x1),
                    y0: bestP.box.y0, y1: Math.max(bestP.box.y1, b.y1) };
            } else {
                paras.push({ lines: [s], lastH: sh, box: { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 } });
            }
        });
        return paras.map(P => P.lines);
    }

    // Convierte los grupos (píxeles, origen arriba-izquierda) a la página
    // estándar {paragraphs, geo} en puntos PDF (origen abajo-izquierda).
    // Los párrafos gigantes se parten para que el auto-ajuste del PDF
    // diseño no encoja demasiado la fuente.
    function trOcrBuildPage(groups, vp) {
        const paragraphs = [];
        const geoList = [];
        const pageArea = Math.max(1, vp.width * vp.height);
        groups.forEach(lines => {
            for (let start = 0; start < lines.length; start += TR_OCR_MAX_LINES_PARA) {
                const chunk = lines.slice(start, start + TR_OCR_MAX_LINES_PARA);
                const texts = [];
                chunk.forEach(l => {
                    const t = l.text;
                    const last = texts.length ? texts[texts.length - 1] : null;
                    if (last && /-$/.test(last) && /^[a-záéíóúüñàèìòùâêîôûäëïöçãõ]/.test(t)) {
                        texts[texts.length - 1] = last.replace(/-$/, '') + t;
                    } else {
                        texts.push(t);
                    }
                });
                const text = texts.join(' ').replace(/\s+/g, ' ').trim();
                if (!text) continue;
                // ---- sanidad del bloque: mata las «cajas exageradas» ----
                // Un bloque real de texto tiene las líneas apretadas dentro
                // de su caja; el ruido de una ilustración queda DISPERSO
                // (poca densidad de caracteres y líneas que no llenan la
                // caja). Ante la duda se descarta y la zona original queda
                // intacta (mejor sin traducir que tapada con basura).
                const cbx0 = Math.min.apply(null, chunk.map(l => l.bbox.x0));
                const cbx1 = Math.max.apply(null, chunk.map(l => l.bbox.x1));
                const cby0 = Math.min.apply(null, chunk.map(l => l.bbox.y0));
                const cby1 = Math.max.apply(null, chunk.map(l => l.bbox.y1));
                const bw = Math.max(cbx1 - cbx0, 1), bh = Math.max(cby1 - cby0, 1);
                const areaPx = bw * bh;
                const dens = text.length / areaPx;            // caracteres por px²
                const linesArea = chunk.reduce((s, l) =>
                    s + Math.max(0, l.bbox.x1 - l.bbox.x0) * Math.max(0, l.bbox.y1 - l.bbox.y0), 0);
                const fill = linesArea / areaPx;              // cuánta caja llenan las líneas
                if (!/\d/.test(text) && text.length < 4) continue;          // fragmento inútil
                if (dens < 0.0008) continue;                  // muy disperso ⇒ ruido de imagen
                if (fill < 0.25 && areaPx > pageArea * 0.03) continue;      // líneas dispersas en caja grande
                if (bh > vp.height * 0.45 && fill < 0.5) continue;          // media página y hueca
                // Geometría por LÍNEA (no solo el bloque): el generador de
                // diseño dibuja una tapa fina por renglón en vez de un solo
                // rectángulo del bloque entero. «size» es el cuerpo real de
                // la fuente (alto de bbox × 0.74), no el alto bruto: antes
                // cada caja OCR salía ~2.3 veces más alta que el texto y por
                // eso tapaba zonas sanas del PDF.
                const ls = chunk.map(l => {
                    const a = vp.convertToPdfPoint(l.bbox.x0, l.bbox.y0);
                    const b = vp.convertToPdfPoint(l.bbox.x1, l.bbox.y1);
                    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
                    const yTop = Math.max(a[1], b[1]), yBot = Math.min(a[1], b[1]);
                    return { x0: x0, x1: x1, yTop: yTop, yBot: yBot, h: Math.max(yTop - yBot, 1) };
                }).filter(l => l.x1 - l.x0 > 0.5 && l.h > 2);
                if (!ls.length) continue;
                const hsrt = ls.map(l => l.h).slice().sort((a, b) => a - b);
                const size = Math.max(hsrt[Math.floor(hsrt.length / 2)] * 1.05, 4.5);
                let leading = size * 1.3;
                if (ls.length > 1) {
                    const step = Math.abs(ls[0].yTop - ls[ls.length - 1].yTop) / (ls.length - 1);
                    leading = Math.min(Math.max(step, size * 1.05), size * 1.9);
                }
                paragraphs.push(text);
                geoList.push({
                    x0: Math.min.apply(null, ls.map(l => l.x0)),
                    x1: Math.max.apply(null, ls.map(l => l.x1)),
                    yTop: Math.max.apply(null, ls.map(l => l.yTop)),
                    yBot: Math.min.apply(null, ls.map(l => l.yBot)),
                    size: size, leading: leading, bold: false, italic: false,
                    n: ls.length, ocr: true, ocrLines: ls
                });
            }
        });
        return { paragraphs: paragraphs, geo: geoList, ocrDone: true };
    }

    // Páginas que necesitan OCR según el modo elegido. Las ya marcadas
    // con ocrDone (reintento tras corte) se omiten.
    function trOcrNeededPages(doc, mode) {
        const need = [];
        (doc.pages || []).forEach((pg, i) => {
            if (pg.ocrDone) return;
            const chars = (doc.pageChars && doc.pageChars[i] != null) ? doc.pageChars[i] : 999;
            if (mode === 'siempre') need.push(i);
            else if (mode === 'auto' && chars < TR_OCR_MIN_CHARS) need.push(i);
        });
        return need;
    }

    // Renderiza una página a canvas a ~2000 px de ancho (Óptimo OCR) y
    // aplica pre-proceso de contraste. La resolución importa: el texto
    // pequeño de maquetas densas (recuadros, notas) a 1700 px queda con
    // glifos de ~10 px que el LSTM confunde («evil»→«evi», «foretold»→«doomed»).
    async function trOcrRenderPage(pdf, pageNum) {
        const page = await pdf.getPage(pageNum);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = Math.min(4, Math.max(2, 2000 / vp1.width));
        const vp = page.getViewport({ scale: scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(vp.width));
        canvas.height = Math.max(1, Math.floor(vp.height));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        trOcrPreprocess(canvas);
        return { canvas: canvas, vp: vp };
    }

    // Pre-proceso que eleva MUCHO la precisión del OCR en escaneos con
    // papel coloreado o texturizado (beige, crema, sepia — el caso típico
    // de los libros ilustrados): Tesseract umbraliza la página en un solo
    // paso y sobre color plano confunde textura del papel con trazos.
    //  1) convierte a gris (luminancia)
    //  2) estira el contraste con los percentiles 3 % / 97 % como límites:
    //     el papel beige (~230 en gris) pasa a blanco puro y la tinta a
    //     negro puro, sin tocar la forma de los glifos.
    // No se binariza: el antialiasing de los glifos ayuda al LSTM.
    function trOcrPreprocess(canvas) {
        let ctx;
        try { ctx = canvas.getContext('2d', { willReadFrequently: true }); } catch (e) { return; }
        let img;
        try { img = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (e) { return; }
        const d = img.data;
        const n = d.length >> 2;
        const hist = new Uint32Array(256);
        const gray = new Uint8ClampedArray(n);
        for (let i = 0, j = 0; j < n; i += 4, j++) {
            const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
            gray[j] = g;
            hist[g | 0]++;
        }
        let lo = 0, hi = 255, acc = 0;
        const loT = n * 0.03, hiT = n * 0.97;
        for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= loT) { lo = v; break; } }
        acc = 0;
        for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= hiT) { hi = v; break; } }
        if (hi - lo < 40) return;   // imagen ya contrastada: no tocar
        const sc = 255 / (hi - lo);
        for (let i = 0, j = 0; j < n; i += 4, j++) {
            let g = (gray[j] - lo) * sc;
            g = g < 0 ? 0 : (g > 255 ? 255 : g | 0);
            d[i] = d[i + 1] = d[i + 2] = g;
        }
        ctx.putImageData(img, 0, 0);
    }

    // Ejecuta OCR sobre las páginas indicadas. Devuelve Map pageIndex →
    // página {paragraphs, geo}. Respeta la cancelación: las páginas ya
    // leídas se conservan para el corte parcial.
    async function trOcrPages(file, pageIdxs, lang, onProgress) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const worker = await trOcrWorker(lang);
        const out = new Map();
        for (let k = 0; k < pageIdxs.length; k++) {
            if (trCancelRequested) break;
            const pi = pageIdxs[k];
            const rendered = await trOcrRenderPage(pdf, pi + 1);
            trOcrStatusCb = (m) => {
                if (!onProgress) return;
                const st = (m && m.status) || '';
                const fase = st.indexOf('recognizing') === 0 ? 'leyendo texto'
                    : st.indexOf('traineddata') !== -1 ? 'descargando idioma'
                    : (st.indexOf('core') !== -1 || st.indexOf('initializing') !== -1) ? 'preparando motor'
                    : 'procesando';
                onProgress(k, pageIdxs.length, (m && m.progress) || 0, fase);
            };
            let res;
            try {
                res = await worker.recognize(rendered.canvas);
            } catch (e) {
                rendered.canvas.width = 0; rendered.canvas.height = 0;
                trOcrStatusCb = null;
                throw new Error('el OCR falló en la página ' + (pi + 1) + ': ' + ((e && e.message) || e));
            }
            rendered.canvas.width = 0; rendered.canvas.height = 0;
            out.set(pi, trOcrBuildPage(trOcrParagraphsFromData(res.data), rendered.vp));
            if (onProgress) onProgress(k + 1, pageIdxs.length, 1, 'página lista');
        }
        trOcrStatusCb = null;
        return out;
    }

    // Hook de depuración/pruebas (no interfiere en la app): permite validar
    // los filtros OCR desde la consola o tests automatizados.
    window.__trOcrDebug = {
        lineIsGarbage: trOcrLineIsGarbage,
        paragraphsFromData: trOcrParagraphsFromData,
        buildPage: trOcrBuildPage,
        mergePage: trMergeOcrPage,
        MIN_WORD_CONF: TR_OCR_MIN_WORD_CONF
    };

    // ===== Control de parada =====
    let trCancelRequested = false;    // usuario pulsó "Detener"
    let trStopReason = null;          // 'cancelado' | 'servicio'
    let trConsecFails = 0;            // fallos consecutivos (circuit breaker)

    function trCleanSeg(s) { return s.replace(/\s*\n\s*/g, ' ').trim(); }

    // Traduce un lote de párrafos en UNA petición (unidos con saltos de
    // línea) y valida estrictamente que la respuesta conserve el mismo
    // número de partes. Si la validación falla, el llamante recurre a la
    // traducción individual: nunca se corrompe el documento.
    async function trTranslateBatchSegs(segs, sl, tl) {
        const clean = segs.map(trCleanSeg);
        const joined = clean.join('\n');
        const r = await trTranslateRaw(joined, sl, tl);
        const parts = String(r.text).split('\n').map(s => s.trim());
        if (parts.length !== clean.length) throw new Error('batch-formato');
        for (let i = 0; i < parts.length; i++) {
            if (!parts[i]) throw new Error('batch-formato');
            if (parts[i].length > clean[i].length * 3 + 60) throw new Error('batch-formato');
        }
        return parts;
    }

    // Deduplica segmentos idénticos (encabezados/pies repetidos) y los
    // traduce en lotes para multiplicar la velocidad y reducir peticiones.
    // Devuelve { pages, ok } donde ok marca qué párrafos quedaron bien
    // traducidos (para el corte parcial en caso de parada).
    async function trTranslatePages(pages, sl, tl, onProgress) {
        const uniqueMap = new Map();
        const uniqList = [];
        const targets = [];

        pages.forEach((pg, pi) => {
            pg.paragraphs.forEach((p, qi) => {
                if (!p.trim()) return;
                if (!uniqueMap.has(p)) { uniqueMap.set(p, uniqList.length); uniqList.push(p); }
                targets.push([pi, qi, uniqueMap.get(p)]);
            });
        });

        const translated = new Array(uniqList.length).fill(null);
        const okMap = new Array(uniqList.length).fill(false);
        let done = 0;
        let wordsDone = 0;

        // Rellena desde la caché los segmentos ya traducidos (reanudación):
        // los lotes que se formen después solo incluirán pendientes reales.
        for (let ui = 0; ui < uniqList.length; ui++) {
            const cached = trCache.get(sl + '|' + tl + '|' + uniqList[ui]);
            if (typeof cached === 'string' && cached) {
                translated[ui] = cached;
                okMap[ui] = true;
                done++;
                wordsDone += trWords(uniqList[ui]);
            }
        }
        if (done && onProgress) onProgress(done, uniqList.length, wordsDone);

        let i = 0;
        let pendientes = uniqList.length;
        const pendiente = (idx) => translated[idx] === null;

        while (i < uniqList.length) {
            if (done >= pendientes) break;
            if (trCancelRequested) { trStopReason = 'cancelado'; break; }

            // salta los segmentos ya resueltos por la caché
            if (!pendiente(i)) { i++; continue; }

            // Construye un lote respetando el límite del proveedor preferente
            // (solo segmentos pendientes; los de caché no van en la petición)
            const prefLimit = ((TR_PROVIDERS[trProvider] || TR_PROVIDERS.google).limit) - 60;
            const batch = [uniqList[i]];
            let len = trCleanSeg(batch[0]).length;
            let j = i + 1;
            while (j < uniqList.length && batch.length < TR_BATCH_MAX) {
                if (!pendiente(j)) { j++; continue; }
                const L = trCleanSeg(uniqList[j]).length;
                if (len + 1 + L > prefLimit) break;
                batch.push(uniqList[j]);
                len += 1 + L;
                j++;
            }

            let parts = null;
            if (batch.length > 1) {
                try { parts = await trTranslateBatchSegs(batch, sl, tl); }
                catch (e) { parts = null; }   // cualquier fallo → traducción individual
            }

            for (let k = 0; k < batch.length && !trCancelRequested; k++) {
                const ui = i + k;
                if (!pendiente(ui)) continue;   // resuelto por caché
                if (parts) {
                    translated[ui] = parts[k];
                    okMap[ui] = true;
                    trCache.set(sl + '|' + tl + '|' + batch[k], parts[k]);
                    trConsecFails = 0;
                } else {
                    try {
                        translated[ui] = await trTranslateSegment(batch[k], sl, tl);
                        okMap[ui] = true;
                        trConsecFails = 0;
                    } catch (err) {
                        translated[ui] = batch[k];       // conserva el original
                        okMap[ui] = false;
                        trFailedSegments++;
                        trConsecFails++;
                    }
                }
                done++;
                wordsDone += trWords(batch[k]);
                if (onProgress) onProgress(done, uniqList.length, wordsDone);
            }

            trCacheScheduleSave();

            // La cancelación del usuario tiene prioridad sobre el breaker
            if (trCancelRequested) { trStopReason = 'cancelado'; break; }

            // Circuit breaker: el servicio está caído → corta el documento
            if (trConsecFails >= TR_CONSEC_FAILS_STOP && !parts) {
                trStopReason = 'servicio';
                break;
            }

            await trSleep(140);
            i = j;
        }

        // Los segmentos no alcanzados conservan el texto original
        translated.forEach((v, idx) => { if (v === null) translated[idx] = uniqList[idx]; });

        const outPages = pages.map(pg => ({ paragraphs: pg.paragraphs.map(() => '') }));
        const outOk = pages.map(pg => pg.paragraphs.map(() => false));
        targets.forEach(([pi, qi, ui]) => {
            outPages[pi].paragraphs[qi] = translated[ui];
            outOk[pi][qi] = okMap[ui];
        });
        return { pages: outPages, ok: outOk };
    }

    // ---------- Generador TXT ----------
    function trBuildTxt(origPages, transPages, bilingual) {
        let out = '';
        origPages.forEach((pg, i) => {
            out += '— Página ' + (i + 1) + ' —\n\n';
            const tp = (transPages[i] && transPages[i].paragraphs) || [];
            const n = Math.max(pg.paragraphs.length, tp.length);
            for (let qi = 0; qi < n; qi++) {
                const p = pg.paragraphs[qi] || '';
                const t = tp[qi] || '';
                if (!p && !t) continue;
                if (bilingual && p) out += p + '\n';
                if (t) out += t + '\n';
                out += '\n';
            }
        });
        return new Blob([out], { type: 'text/plain;charset=utf-8' });
    }

    // ---------- Generador Word (.docx) ----------
    async function trBuildDocx(origPages, transPages, bilingual) {
        const { Document, Packer, Paragraph, TextRun, PageBreak } = window.docx;
        const children = [];

        origPages.forEach((pg, i) => {
            const tp = (transPages[i] && transPages[i].paragraphs) || [];
            const n = Math.max(pg.paragraphs.length, tp.length);
            for (let qi = 0; qi < n; qi++) {
                const p = pg.paragraphs[qi] || '';
                const t = tp[qi] || '';
                if (!p && !t) { children.push(new Paragraph({ text: '' })); continue; }
                if (bilingual && p) {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: p, color: '888888', italics: true, size: 20 })]
                    }));
                }
                children.push(new Paragraph({
                    children: [new TextRun({ text: t || p, size: 24 })]
                }));
                children.push(new Paragraph({ text: '' }));
            }
            if (i < origPages.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
        });

        if (!children.length) children.push(new Paragraph({ text: '' }));
        const doc = new Document({ sections: [{ properties: {}, children }] });
        return await Packer.toBlob(doc);
    }

    // ---------- Generador PDF (vía canvas: soporta todos los alfabetos) ----------
    const TR_RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\uFB1D-\uFDFF\uFE70-\uFEFC]/;
    const TR_FONT_STACK = '"Segoe UI", "Noto Sans", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif';

    async function trBuildPdf(origPages, transPages, bilingual, onProgress) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

        const W = 595.28, H = 841.89, S = 2;
        const cWidth = Math.round(W * S), cHeight = Math.round(H * S);
        const ML = 56 * S, MR = 56 * S, MT = 60 * S, MB = 66 * S;

        const canvas = document.createElement('canvas');
        canvas.width = cWidth; canvas.height = cHeight;
        const ctx = canvas.getContext('2d');

        let y = MT;
        let pageNo = 0;

        function startPage() {
            if (pageNo > 0) {
                drawFooter();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, W, H);
                pdf.addPage();
            }
            pageNo++;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cWidth, cHeight);
            ctx.textBaseline = 'top';
            y = MT;
        }

        function drawFooter() {
            ctx.save();
            ctx.fillStyle = '#999999';
            ctx.font = '18px ' + TR_FONT_STACK;
            ctx.direction = 'ltr';
            ctx.textAlign = 'center';
            ctx.fillText(String(pageNo), cWidth / 2, cHeight - 40 * S);
            ctx.restore();
        }

        function drawParagraph(text, fontPx, italic, color, isCjk) {
            const font = (italic ? 'italic ' : '') + fontPx + 'px ' + TR_FONT_STACK;
            const lh = Math.ceil(fontPx * 1.5);
            const maxW = cWidth - ML - MR;
            const rtl = TR_RTL_RE.test(text);

            ctx.font = font;
            ctx.fillStyle = color;
            ctx.direction = rtl ? 'rtl' : 'ltr';
            ctx.textAlign = rtl ? 'right' : 'left';

            const lines = wrapForCanvas(text, maxW, isCjk);
            const x = rtl ? cWidth - MR : ML;
            lines.forEach(ln => {
                if (y + lh > cHeight - MB) {
                    startPage();
                    ctx.font = font;
                    ctx.fillStyle = color;
                    ctx.direction = rtl ? 'rtl' : 'ltr';
                    ctx.textAlign = rtl ? 'right' : 'left';
                }
                ctx.fillText(ln, x, y);
                y += lh;
            });
            y += 10;
        }

        function wrapForCanvas(text, maxW, isCjk) {
            const lines = [];
            if (isCjk) {
                let line = '';
                for (const ch of text) {
                    if (line && ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
                    else line += ch;
                }
                if (line) lines.push(line);
                return lines;
            }
            const words = text.split(/\s+/).filter(Boolean);
            let line = '';
            for (let w of words) {
                while (ctx.measureText(w).width > maxW && w.length > 1) {
                    let cut = w.length - 1;
                    while (cut > 1 && ctx.measureText(w.slice(0, cut) + '-').width > maxW) cut--;
                    const head = w.slice(0, cut) + '-';
                    if (line) { lines.push(line); line = ''; }
                    lines.push(head);
                    w = w.slice(cut);
                }
                const test = line ? line + ' ' + w : w;
                if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
                else line = test;
            }
            if (line) lines.push(line);
            return lines;
        }

        origPages.forEach((pg, i) => {
            if (onProgress) onProgress((i + 1) / origPages.length);
            startPage();
            const tp = (transPages[i] && transPages[i].paragraphs) || [];
            const n = Math.max(pg.paragraphs.length, tp.length);
            for (let qi = 0; qi < n; qi++) {
                const p = pg.paragraphs[qi] || '';
                const t = tp[qi] || '';
                if (!p && !t) { y += 8; continue; }
                if (bilingual && p) drawParagraph(p, 20, true, '#666666', TR_CJK_RE.test(p));
                drawParagraph(t || p, 24, false, '#111111', TR_CJK_RE.test(t || p));
            }
        });
        drawFooter();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, W, H);

        return pdf.output('blob');
    }

    // ---------- Generador PDF fiel al diseño original (pdf-lib) ----------
    // Reabre el PDF original y sustituye SOLO el texto: tapa cada párrafo
    // con un rectángulo del color de fondo y escribe la traducción en la
    // misma posición, reajustando el cuerpo para que quepa. Imágenes,
    // tablas, vectores, colores y maquetación del original quedan intactos.

    // Idiomas destino compatibles: las fuentes estándar del PDF (Helvetica)
    // cubren alfabeto latino (WinAnsi). Para CJK/árabe/cirílico se usa el
    // generador reformateado (canvas), que sí soporta todos los alfabetos.
    const TR_LAYOUT_LANGS = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ca', 'nl', 'sv', 'da', 'no', 'fi', 'id', 'ms', 'sw', 'tl'];

    // Caracteres WinAnsi por encima de Latin-1 (se conservan sin cambio)
    const TR_WINANSI_EXTRA = /[\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/;

    function trSanitizeWinAnsi(s) {
        s = String(s || '')
            .replace(/[\u00A0\u2007\u202F\u2009\u0009\u000B\u000C]/g, ' ')
            .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
            .replace(/[\u201C\u201D\u2033]/g, '"')
            .replace(/[\u2013\u2014\u2212]/g, '-')
            .replace(/\u2026/g, '...');
        let out = '';
        for (const ch of s) {
            const cp = ch.codePointAt(0);
            if (cp <= 255 || TR_WINANSI_EXTRA.test(ch)) { out += ch; continue; }
            const d = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            out += (d.length === 1 && d.codePointAt(0) <= 255) ? d : '?';
        }
        return out;
    }

    function trWrapPdf(text, font, fs, maxW) {
        const words = text.split(/\s+/).filter(Boolean);
        const lines = [];
        let line = '';
        for (let w of words) {
            while (font.widthOfTextAtSize(w, fs) > maxW && w.length > 1) {
                let cut = w.length - 1;
                while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut) + '-', fs) > maxW) cut--;
                if (line) { lines.push(line); line = ''; }
                lines.push(w.slice(0, cut) + '-');
                w = w.slice(cut);
            }
            const test = line ? line + ' ' + w : w;
            if (font.widthOfTextAtSize(test, fs) > maxW && line) { lines.push(line); line = w; }
            else line = test;
        }
        if (line) lines.push(line);
        return lines.length ? lines : [''];
    }

    async function trBuildPdfLayout(file, origPages, transPages, bilingual, onProgress, deferred = []) {
        if (!window.PDFLib) throw new Error('la librería pdf-lib no está disponible');
        const { PDFDocument, StandardFonts, rgb } = PDFLib;

        const bytes = await file.arrayBuffer();
        let pdf;
        try {
            pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        } catch (e) {
            throw new Error('el PDF original no se pudo reabrir con precisión');
        }

        const F = {
            reg: await pdf.embedFont(StandardFonts.Helvetica),
            bold: await pdf.embedFont(StandardFonts.HelveticaBold),
            ital: await pdf.embedFont(StandardFonts.HelveticaOblique),
            boldItal: await pdf.embedFont(StandardFonts.HelveticaBoldOblique)
        };
        const pick = (b, i) => b ? (i ? F.boldItal : F.bold) : (i ? F.ital : F.reg);

        // Renderiza cada página en un canvas (PDF.js) para MUESTREAR el color
        // de fondo real de cada bloque: así la tapa del texto original es
        // invisible incluso sobre fondos de color (cabeceras, tablas, cajas).
        let pdfjsDoc = null;
        try {
            pdfjsDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        } catch (e) { pdfjsDoc = null; }

        const pagesAll = pdf.getPages();
        const total = Math.min(origPages.length, pagesAll.length);
        const GRIS = rgb(0.45, 0.45, 0.45);
        const NEGRO = rgb(0.08, 0.08, 0.08);
        const ROJO = rgb(0.72, 0.15, 0.15);

        for (let p = 0; p < total; p++) {
            const page = pagesAll[p];
            if (page.getRotation().angle % 360 !== 0) {
                deferred.push({ page: p + 1, reason: 'Página rotada: se conserva el original', text: ((transPages[p] || {}).paragraphs || []).join('\n\n') });
                continue;
            }
            const W = page.getSize().width;

            let cctx = null, cvsW = 0, cvsH = 0;
            if (pdfjsDoc) {
                try {
                    const pj = await pdfjsDoc.getPage(p + 1);
                    const vp = pj.getViewport({ scale: 1 });
                    const cvs = document.createElement('canvas');
                    cvs.width = Math.max(1, Math.ceil(vp.width));
                    cvs.height = Math.max(1, Math.ceil(vp.height));
                    const cx = cvs.getContext('2d', { willReadFrequently: true });
                    await pj.render({ canvasContext: cx, viewport: vp }).promise;
                    cctx = cx; cvsW = cvs.width; cvsH = cvs.height;
                } catch (e) { cctx = null; }
            }
            const sampleBG = (x, y) => {
                if (!cctx) return null;
                const px = Math.min(cvsW - 1, Math.max(0, Math.round(x)));
                const py = Math.min(cvsH - 1, Math.max(0, Math.round(cvsH - y)));
                const d = cctx.getImageData(px, py, 1, 1).data;
                return [d[0] / 255, d[1] / 255, d[2] / 255];
            };
            // Color de fondo real del bloque: se muestrea DENTRO de la caja
            // (esquinas interiores, centro y huecos entre renglones, que son
            // papel puro) y se vota el color cuantizado más frecuente. Antes
            // se muestreaba FUERA y sobre ilustraciones devolvía colores del
            // arte (beige/marrón), tapando el diseño con cajas exageradas.
            const bgColor = (g) => {
                if (!cctx) return [1, 1, 1];
                const bw = Math.max(g.x1 - g.x0, 1), bh = Math.max(g.yTop - g.yBot, 1);
                const pts = [];
                [0.12, 0.5, 0.88].forEach(a => [0.15, 0.5, 0.85].forEach(b =>
                    pts.push([g.x0 + bw * a, g.yBot + bh * b])));
                const nl = Math.max(1, Math.min(g.n || 1, 6));
                for (let i = 1; i < nl; i++) pts.push([g.x0 + bw * 0.5, g.yBot + (bh * i) / nl]);
                const votes = new Map();
                pts.forEach(p => {
                    const c = sampleBG(p[0], p[1]);
                    if (!c) return;
                    const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
                    const key = Math.round(c[0] * 12) + ',' + Math.round(c[1] * 12) + ',' + Math.round(c[2] * 12);
                    const v = votes.get(key);
                    if (v) { v.n++; v.lum = Math.max(v.lum, lum); }
                    else votes.set(key, { n: 1, c: c, lum: lum });
                });
                if (!votes.size) return [1, 1, 1];
                let best = null;
                votes.forEach(v => { if (!best || v.n > best.n || (v.n === best.n && v.lum > best.lum)) best = v; });
                if (best.lum < 0.35) {   // dominante oscuro (texto sobre arte): usa el punto más claro
                    let bright = best;
                    votes.forEach(v => { if (v.lum > bright.lum) bright = v; });
                    if (bright.lum > best.lum + 0.15) best = bright;
                }
                return best.c;
            };

            const oPage = origPages[p], tPage = transPages[p];
            const geos = (oPage && oPage.geo) || [];
            const allSizes = geos.filter(Boolean).map(g => g.size).sort((a, b) => a - b);
            const medSize = allSizes.length ? allSizes[Math.floor(allSizes.length / 2)] : 10;

            const notices = [];
            for (let qi = 0; qi < tPage.paragraphs.length; qi++) {
                const tRaw = ((tPage.paragraphs[qi] || '') + '').trim();
                const oRaw = (((oPage && oPage.paragraphs[qi]) || '') + '').trim();
                const geo = geos[qi];
                if (!geo) {
                    if (tRaw) notices.push(tRaw);   // p. ej. aviso de traducción parcial
                    continue;
                }
                if (!tRaw && !oRaw) continue;
                if (!bilingual && (!tRaw || tRaw === oRaw)) continue;

                const orig = trSanitizeWinAnsi(oRaw);
                const trans = trSanitizeWinAnsi(tRaw) || orig;
                const negrita = geo.bold || (geo.n === 1 && oRaw.length < 90 && geo.size >= medSize * 1.16);

                const boxW = Math.max(geo.x1 - geo.x0, geo.size * 4);
                const boxH = (geo.yTop - geo.yBot) + geo.size * 1.35;
                const centrado = geo.n === 1 && oRaw.length < 90
                    && Math.abs((geo.x0 + geo.x1) / 2 - W / 2) < Math.max(16, W * 0.035);

                // 1) tapar el texto original con el color de fondo real
                const bg = bgColor(geo);

                // OCR: fit before drawing; preserve the original when it cannot fit.
                if (geo.ocr) {
                    const boxWo = geo.x1 - geo.x0;
                    const fitH = geo.yTop - geo.yBot;
                    if (boxWo <= 0 || fitH <= 0) continue;
                    const fontO = pick(negrita, geo.italic);
                    const minSize = Math.max(5, geo.size * 0.65);
                    let fsOcr = Math.max(minSize, geo.size), lnOcr, lnOr, fsOr, blockH;
                    for (;;) {
                        lnOcr = trWrapPdf(trans, fontO, fsOcr, boxWo);
                        fsOr = bilingual && orig ? Math.max(fsOcr * 0.7, 5) : 0;
                        lnOr = fsOr ? trWrapPdf(orig, F.reg, fsOr, boxWo) : [];
                        blockH = lnOcr.length * fsOcr * 1.2 +
                            (lnOr.length ? fsOcr * 0.3 + lnOr.length * fsOr * 1.2 : 0);
                        if (blockH <= fitH || fsOcr <= minSize) break;
                        fsOcr = Math.max(minSize, fsOcr * 0.95);
                    }
                    if (blockH > fitH || lnOcr.some(ln => fontO.widthOfTextAtSize(ln, fsOcr) > boxWo) ||
                        lnOr.some(ln => F.reg.widthOfTextAtSize(ln, fsOr) > boxWo)) {
                        deferred.push({ page: p + 1, reason: 'El bloque no cabe con letra legible', text: trans });
                        continue; // No mask or text has been drawn: keep the original region.
                    }
                    // Mask the entire source area, even when the translation is shorter.
                    page.drawRectangle({ x: geo.x0 - 0.5, y: geo.yBot - 0.5,
                        width: boxWo + 1, height: fitH + 1, color: rgb(...bg) });
                    let yo = geo.yTop - fsOcr;
                    for (const ln of lnOcr) {
                        const x = centrado ? geo.x0 + (boxWo - fontO.widthOfTextAtSize(ln, fsOcr)) / 2 : geo.x0;
                        page.drawText(ln, { x, y: yo, size: fsOcr, font: fontO, color: NEGRO });
                        yo -= fsOcr * 1.2;
                    }
                    if (lnOr.length) {
                        yo -= fsOcr * 0.3;
                        for (const ln of lnOr) {
                            page.drawText(ln, { x: geo.x0, y: yo, size: fsOr, font: F.reg, color: GRIS });
                            yo -= fsOr * 1.2;
                        }
                    }
                    continue;
                }

                const padX = 2, padTop = geo.size * 0.85, padBot = geo.size * 0.35;
                page.drawRectangle({
                    x: geo.x0 - padX, y: geo.yBot - padBot,
                    width: boxW + padX * 2,
                    height: (geo.yTop - geo.yBot) + padTop + padBot,
                    color: rgb(bg[0], bg[1], bg[2])
                });

                // 2) ajustar cuerpo y re-lienar la traducción en la caja
                let fs = geo.size;
                let fontT = pick(negrita, geo.italic);
                let lines = trWrapPdf(trans, fontT, fs, boxW);
                for (let guard = 0; guard < 40; guard++) {
                    const fsO = bilingual && orig ? Math.max(fs * 0.52, 5) : 0;
                    const nO = bilingual && orig ? trWrapPdf(orig, F.reg, fsO, boxW).length : 0;
                    const leadT = (fs === geo.size && geo.n > 1 && !nO) ? geo.leading : fs * 1.25;
                    const needH = nO * (fsO * 1.22) + (nO ? fs * 0.35 : 0) + lines.length * leadT;
                    if (needH <= boxH || fs <= geo.size * 0.5) break;
                    fs *= 0.94;
                    fontT = pick(negrita, geo.italic);
                    lines = trWrapPdf(trans, fontT, fs, boxW);
                }

                // 3) escribir la traducción (nunca se recorta contenido)
                const fsO = bilingual && orig ? Math.max(fs * 0.52, 5) : 0;
                const origLines = (bilingual && orig) ? trWrapPdf(orig, F.reg, fsO, boxW) : [];
                let y = geo.yTop;
                const putLine = (ln, fnt, size, color) => {
                    const x = centrado ? geo.x0 + (boxW - fnt.widthOfTextAtSize(ln, size)) / 2 : geo.x0;
                    page.drawText(ln, { x: x, y: y, size: size, font: fnt, color: color });
                };
                for (const ln of origLines) {
                    putLine(ln, F.reg, fsO, GRIS);
                    y -= fsO * 1.22;
                }
                if (origLines.length) y -= fs * 0.35;
                const leadT = (fs === geo.size && geo.n > 1 && !origLines.length) ? geo.leading : fs * 1.25;
                for (const ln of lines) {
                    putLine(ln, fontT, fs, NEGRO);
                    y -= leadT;
                }
            }

            // avisos (traducción parcial) al pie de la página
            if (notices.length) {
                let ny = 30;
                const txt = trSanitizeWinAnsi(notices.join(' '));
                for (const ln of trWrapPdf(txt, F.reg, 7.5, W - 64)) {
                    page.drawText(ln, { x: 32, y: ny, size: 7.5, font: F.reg, color: ROJO });
                    ny -= 10;
                    if (ny < 12) break;
                }
            }

            if (onProgress) onProgress((p + 1) / total);
        }

        const out = await pdf.save({ useObjectStreams: false });
        return new Blob([out], { type: 'application/pdf' });
    }

    function globeIconSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>`;
    }

    // ============================================================
    // ==================== MODO TRADUCIR PDF ======================
    // ============================================================
    const dropZoneTr = $('#dropZoneTr');
    const fileInputTr = $('#fileInputTr');
    const uploadSectionTr = $('#uploadSectionTr');
    const optionsSectionTr = $('#optionsSectionTr');
    const progressSectionTr = $('#progressSectionTr');
    const resultsSectionTr = $('#resultsSectionTr');
    const fileNameTr = $('#fileNameTr');
    const removeFileTr = $('#removeFileTr');
    const trQueueEl = $('#trQueue');
    const sourceLangSelect = $('#sourceLangSelect');
    const targetLangSelect = $('#targetLangSelect');
    const swapLangBtn = $('#swapLangBtn');
    const trFormatSelector = $('#trFormatSelector');
    const bilingualCheckTr = $('#bilingualCheckTr');
    const convertBtnTr = $('#convertBtnTr');
    const progressTitleTr = $('#progressTitleTr');
    const progressPercentTr = $('#progressPercentTr');
    const progressFillTr = $('#progressFillTr');
    const resultsMetaTr = $('#resultsMetaTr');
    const downloadZipBtnTr = $('#downloadZipBtnTr');
    const filesListTr = $('#filesListTr');
    const trStatsBar = $('#trStatsBar');
    const trProgressStats = $('#trProgressStats');
    const trCancelBtn = $('#trCancelBtn');

    let trFiles = [];
    let isConvertingTr = false;
    let trResults = [];

    dropZoneTr.addEventListener('click', () => fileInputTr.click());
    fileInputTr.addEventListener('change', (e) => {
        if (e.target.files.length) handleTrFiles(Array.from(e.target.files));
    });
    dropZoneTr.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneTr.classList.add('dragover'); });
    dropZoneTr.addEventListener('dragleave', () => dropZoneTr.classList.remove('dragover'));
    dropZoneTr.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZoneTr.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        if (files.length) handleTrFiles(files);
        else showToast('Solo se permiten archivos PDF', 'error');
    });

    removeFileTr.addEventListener('click', resetTrMode);
    convertBtnTr.addEventListener('click', startTrTranslate);
    downloadZipBtnTr.addEventListener('click', () => downloadResultsZip(trResults, 'documentos-traducidos.zip', downloadZipBtnTr));
    trCancelBtn.addEventListener('click', () => {
        if (trCancelRequested) return;
        trCancelRequested = true;
        showToast('Deteniendo… se generará el documento con lo traducido hasta ahora', '');
    });

    swapLangBtn.addEventListener('click', () => {
        const s = sourceLangSelect.value;
        const t = targetLangSelect.value;
        if (s === 'auto') {
            sourceLangSelect.value = t;
            targetLangSelect.value = (t !== 'es') ? 'es' : 'en';
        } else {
            sourceLangSelect.value = t;
            targetLangSelect.value = s;
        }
    });

    trFormatSelector.querySelectorAll('.segment').forEach(btn => {
        btn.addEventListener('click', () => {
            trFormatSelector.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const addMoreFileTr = $('#addMoreFileTr');
    const addMoreInputTr = $('#addMoreInputTr');
    if (addMoreFileTr && addMoreInputTr) {
        addMoreFileTr.addEventListener('click', () => {
            addMoreInputTr.value = '';
            addMoreInputTr.click();
        });
        addMoreInputTr.addEventListener('change', (e) => {
            if (e.target.files.length) handleTrFiles(Array.from(e.target.files));
        });
    }

    const trSortSelect = $('#trSortSelect');
    if (trSortSelect) {
        trSortSelect.addEventListener('change', () => {
            if (trFiles.length) {
                trFiles = sortFiles(trFiles, trSortSelect.value);
                redrawTrQueue();
            }
        });
    }

    function handleTrFiles(files) {
        const valid = [];
        const tooBig = [];
        files.forEach(f => {
            if (f.type !== 'application/pdf') return;
            if (f.size > TR_MAX_FILE_BYTES) tooBig.push(f);
            else valid.push(f);
        });
        if (tooBig.length) {
            const names = tooBig.slice(0, 3).map(f => f.name + ' (' + formatBytes(f.size) + ')').join(', ');
            showToast('Se omite ' + names + (tooBig.length > 3 ? ' y ' + (tooBig.length - 3) + ' más' : '') + ': el máximo es ' + TR_MAX_FILE_MB + ' MB por PDF', 'error');
        }
        if (!valid.length) {
            if (!tooBig.length) showToast('Solo se permiten archivos PDF', 'error');
            return;
        }
        valid.forEach(file => {
            const id = 'tr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            trFiles.push({ file, id, doc: null, analyzing: false, error: null, words: 0, uniq: 0 });
        });
        const sortValue = $('#trSortSelect') ? $('#trSortSelect').value : 'name-asc';
        trFiles = sortFiles(trFiles, sortValue);
        redrawTrQueue();
        updateTrUI();
        updateTrStatsBar();
        trAnalyzeNext();
    }

    // ===== Pre-análisis en segundo plano: páginas, palabras y ETA por archivo =====
    async function trAnalyzeNext() {
        const item = trFiles.find(it => !it.doc && !it.analyzing && !it.error);
        if (!item) { updateTrStatsBar(); return; }
        item.analyzing = true;
        redrawTrQueue();
        try {
            const doc = await trExtractPdf(item.file, null);
            if (!trFiles.includes(item)) return;   // fue eliminado mientras se analizaba
            item.doc = doc;
            if (!doc.hasText) {
                item.error = 'escaneado';
            } else {
                item.words = doc.pages.reduce((a, p) => a + p.paragraphs.join(' ').split(/\s+/).filter(Boolean).length, 0);
                const s = new Set();
                doc.pages.forEach(p => p.paragraphs.forEach(x => { if (x.trim()) s.add(x); }));
                item.uniq = s.size;
            }
        } catch (e) {
            if (trFiles.includes(item)) item.error = 'lectura';
        }
        item.analyzing = false;
        redrawTrQueue();
        updateTrStatsBar();
        trAnalyzeNext();
    }

    function trFmtMin(seconds) {
        if (seconds < 60) return '<1 min';
        return Math.max(1, Math.round(seconds / 60)) + ' min';
    }

    function trItemMeta(item) {
        if (item.analyzing) return { text: 'Analizando contenido…', warn: false };
        if (item.error === 'escaneado') {
            const n = item.doc && item.doc.pages ? item.doc.pages.length : 0;
            if (trOcrMode() === 'nunca') {
                return { text: 'Sin texto seleccionable (escaneo) — activa el OCR para traducirlo', warn: true };
            }
            return { text: 'Escaneo sin texto — se leerá con OCR (' + n + (n === 1 ? ' página' : ' páginas')
                + ', ≈ ' + trFmtMin(n * TR_OCR_SECS_PAGE) + ' extra la 1.ª vez)', warn: true };
        }
        if (item.error === 'lectura') return { text: 'No se pudo leer el PDF', warn: true };
        if (item.doc) {
            const scanPages = (item.doc.pageChars || []).filter(c => c < TR_OCR_MIN_CHARS).length;
            const est = (item.uniq || 0) / 4.5 + item.doc.pages.length * 0.3
                + ((scanPages && trOcrMode() !== 'nunca') ? scanPages * 1.4 : 0);
            const w = item.words || 0;
            return {
                text: item.doc.pages.length + (item.doc.pages.length === 1 ? ' página · ' : ' páginas · ')
                    + w.toLocaleString('es') + (w === 1 ? ' palabra · ' : ' palabras · ')
                    + '≈ ' + trFmtMin(est * 0.7) + ' – ' + trFmtMin(est * 1.9)
                    + ((scanPages && trOcrMode() !== 'nunca') ? ' · OCR en ' + scanPages : ''),
                warn: false
            };
        }
        return null;
    }

    function updateTrStatsBar() {
        if (!trStatsBar) return;
        if (!trFiles.length) { trStatsBar.style.display = 'none'; return; }
        const analyzing = trFiles.some(it => it.analyzing);
        const ready = trFiles.filter(it => it.doc && !it.error);
        const scanned = trFiles.filter(it => it.error === 'escaneado').length;
        const pages = ready.reduce((a, it) => a + (it.doc ? it.doc.pages.length : 0), 0);
        const words = ready.reduce((a, it) => a + (it.words || 0), 0);
        const uniq = ready.reduce((a, it) => a + (it.uniq || 0), 0);
        const est = uniq / 4.5 + pages * 0.3;
        const parts = [];
        parts.push(trFiles.length + ' archivo' + (trFiles.length !== 1 ? 's' : ''));
        if (pages) parts.push(pages + (pages === 1 ? ' página' : ' páginas'));
        if (words) parts.push(words.toLocaleString('es') + (words === 1 ? ' palabra' : ' palabras'));
        if (uniq) parts.push('tiempo estimado: ' + trFmtMin(est * 0.7) + ' – ' + trFmtMin(est * 1.9));
        if (analyzing) parts.push('analizando…');
        if (scanned) parts.push(trOcrMode() === 'nunca'
            ? scanned + ' sin texto (no traducible)'
            : scanned + ' escaneado(s) → se traducirán con OCR');
        trStatsBar.textContent = parts.join(' · ');
        trStatsBar.style.display = 'block';
    }

    function redrawTrQueue() {
        renderSimpleQueue(trQueueEl, trFiles, 'var(--success)', (id) => {
            trFiles = trFiles.filter(i => i.id !== id);
            redrawTrQueue();
            updateTrUI();
            updateTrStatsBar();
            trAnalyzeNext();
        }, trItemMeta);
    }

    function updateTrUI() {
        const count = trFiles.length;
        if (count > 0) {
            fileNameTr.textContent = `${count} archivo${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`;
            uploadSectionTr.style.display = 'none';
            optionsSectionTr.style.display = 'block';
            resultsSectionTr.style.display = 'none';
            progressSectionTr.style.display = 'none';
        } else {
            resetTrMode();
        }
    }

    function setTrProgress(percent, title) {
        progressFillTr.style.width = percent + '%';
        progressPercentTr.textContent = Math.max(0, Math.min(100, Math.round(percent))) + '%';
        if (title) progressTitleTr.textContent = title;
    }

    async function startTrTranslate() {
        if (!trFiles.length || isConvertingTr) return;

        isConvertingTr = true;
        optionsSectionTr.style.display = 'none';
        progressSectionTr.style.display = 'block';
        resultsSectionTr.style.display = 'none';
        trCancelBtn.style.display = 'inline-flex';
        trProgressStats.textContent = '';
        setTrProgress(0, 'Preparando...');

        const btnLabel = convertBtnTr.querySelector('.btn-label');
        const btnSpinner = convertBtnTr.querySelector('.btn-spinner');
        btnLabel.style.display = 'none';
        btnSpinner.style.display = 'inline-flex';
        convertBtnTr.disabled = true;

        trResults = [];
        trFailedSegments = 0;
        trCancelRequested = false;
        trStopReason = null;
        trConsecFails = 0;
        const total = trFiles.length;
        let fmt = trFormatSelector.querySelector('.segment.active').dataset.value;
        const bilingual = bilingualCheckTr.checked;
        const slSetting = sourceLangSelect.value;
        const tl = targetLangSelect.value;
        const failures = [];
        const t0All = Date.now();
        let totalPagesDone = 0;
        let totalWordsDone = 0;
        let layoutDeferredCount = 0;

        const fmtEta = (s) => {
            s = Math.max(0, Math.round(s));
            const m = Math.floor(s / 60), ss = s % 60;
            return m + ':' + String(ss).padStart(2, '0');
        };
        const fmtInt = (n) => n.toLocaleString('es');

        try {
            for (let i = 0; i < total; i++) {
                const item = trFiles[i];
                const base = (frac, msg) => setTrProgress(((i + frac) / total) * 100, msg);

                try {
                    if (fmt === 'pdf-layout' && TR_LAYOUT_LANGS.indexOf(tl) === -1) {
                        throw new Error('PDF diseño no admite este alfabeto de destino. Selecciona explícitamente PDF reformateado u otro formato.');
                    }
                    // 1) Obtener el texto del PDF (reutiliza el análisis previo)
                    let doc = item.doc;
                    if (doc && doc.hasText) {
                        base(0.2, 'Texto ya analizado — ' + item.file.name);
                    } else {
                        base(0.02, 'Extrayendo texto — ' + item.file.name);
                        doc = await trExtractPdf(item.file, (f) =>
                            base(0.02 + f * 0.18, 'Extrayendo texto (' + Math.round(f * 100) + '%) — ' + item.file.name));
                        item.doc = doc;
                    }

                    doc = { ...doc, pages: doc.pages.map(pg => ({ ...pg, paragraphs: pg.paragraphs.slice(), geo: pg.geo.slice() })) };

                    // 1b) OCR: lee el texto de las páginas escaneadas (o de
                    //     todas si el usuario fuerza «Siempre OCR»). El
                    //     resultado se FUSIONA con la capa digital: el texto
                    //     real se conserva y solo se añaden las zonas que
                    //     faltaban, así el resto del flujo no cambia.
                    const ocrMode = trOcrMode();
                    const ocrPages = trOcrNeededPages(doc, ocrMode);
                    if (ocrPages.length) {
                        const ocrLang = trOcrLang();
                        base(0.04, 'Preparando OCR — ' + item.file.name);
                        const ocrMap = await trOcrPages(item.file, ocrPages, ocrLang,
                            (done, tot, frac, fase) => {
                                base(0.04 + ((done + frac) / Math.max(tot, 1)) * 0.18,
                                    'OCR: ' + fase + ' — ' + item.file.name);
                                trProgressStats.textContent = 'OCR ' + Math.min(done + 1, tot) + '/' + tot
                                    + ' páginas · ' + fase + ' ' + Math.round(frac * 100) + '%';
                            });
                        ocrMap.forEach((pg, idx) => { doc.pages[idx] = trMergeOcrPage(doc.pages[idx], pg); });
                    }

                    const totalParas = doc.pages.reduce((a, p) => a + (p.paragraphs ? p.paragraphs.length : 0), 0);
                    if (!doc.hasText && !totalParas) {
                        throw new Error(ocrMode === 'nunca'
                            ? '"' + item.file.name + '" no tiene texto seleccionable. Activa «Páginas escaneadas (OCR)» en las opciones para poder traducirlo.'
                            : '"' + item.file.name + '": el OCR no detectó texto legible. Prueba con otro «Idioma del documento (OCR)» o con un escaneo de mejor calidad.');
                    }

                    // 2) Detectar idioma de origen si está en automático
                    let sl = slSetting;
                    if (sl === 'auto') {
                        base(0.22, 'Detectando idioma — ' + item.file.name);
                        const sample = doc.pages.map(p => p.paragraphs.join(' ')).join(' ').slice(0, 500);
                        sl = await trDetect(sample);
                    }
                    const srcName = TR_LANG_NAMES[sl] || sl;
                    const dstName = TR_LANG_NAMES[tl] || tl;

                    // 3) Traducir en lotes, con ETA en vivo
                    const t0File = Date.now();
                    let lastWords = 0;
                    const result = await trTranslatePages(doc.pages, sl, tl, (done, tot, wordsDone) => {
                        lastWords = wordsDone;
                        const elapsed = (Date.now() - t0File) / 1000;
                        const eta = done > 0 ? (elapsed / done) * (tot - done) : 0;
                        trProgressStats.textContent = done + '/' + tot + ' secciones · ~' + fmtEta(eta) + ' restante · ' + fmtInt(wordsDone) + ' palabras';
                        base(0.25 + (done / Math.max(tot, 1)) * 0.63, 'Traduciendo ' + srcName + ' → ' + dstName + ' — ' + item.file.name);
                    });
                    const transPages = result.pages;

                    // 4) Corte parcial: si se canceló o el servicio dejó de
                    //    responder, conservar solo las páginas 100% traducidas
                    //    (el documento se corta limpio hasta donde llegó).
                    let kept = doc.pages.length;
                    let cutInfo = null;
                    if (trStopReason) {
                        let lastFull = -1;
                        for (let p = 0; p < doc.pages.length; p++) {
                            const okp = result.ok[p] || [];
                            if (doc.pages[p].paragraphs.every((_, qi) => okp[qi])) lastFull = p;
                            else break;
                        }
                        if (lastFull >= 0) kept = lastFull + 1;
                        cutInfo = { kept: kept, total: doc.pages.length, reason: trStopReason };
                    }

                    // 5) Generar documento de salida
                    base(0.9, 'Generando documento — ' + item.file.name);
                    const outOrig = doc.pages.slice(0, kept);
                    const outTrans = transPages.slice(0, kept);
                    if (cutInfo) {
                        const motivo = cutInfo.reason === 'cancelado'
                            ? 'detenida por el usuario'
                            : 'el servicio de traducción dejó de responder';
                        const notice = cutInfo.kept < cutInfo.total
                            ? '— TRADUCCIÓN PARCIAL: ' + motivo + '. Se conservan las páginas 1 a ' + cutInfo.kept + ' de ' + cutInfo.total + ' (hasta donde llegó la traducción). Vuelve a ejecutar la traducción para continuar: la caché retoma donde se quedó. —'
                            : '— AVISO: la traducción se detuvo (' + motivo + '); algunas secciones quedaron en su idioma original. —';
                        outTrans[outTrans.length - 1].paragraphs.push(notice);
                    }

                    let blob, ext;
                    if (fmt === 'docx') {
                        blob = await trBuildDocx(outOrig, outTrans, bilingual);
                        ext = 'docx';
                    } else if (fmt === 'pdf-layout') {
                        const deferred = [];
                        blob = await trBuildPdfLayout(item.file, outOrig, outTrans, bilingual, (f) =>
                            base(0.9 + f * 0.08, 'Reconstruyendo el diseño — ' + item.file.name), deferred);
                        ext = 'pdf';
                        if (deferred.length) {
                            const report = 'Se conserva el diseño original. Estos bloques no se sustituyeron; su traducción aparece a continuación.\n\n' +
                                deferred.map(d => 'Página ' + d.page + ' — ' + d.reason + '\n' + d.text).join('\n\n');
                            trResults.push({ blob: new Blob([report], { type: 'text/plain;charset=utf-8' }),
                                name: item.file.name.replace(/\.pdf$/i, '') + '_trad_' + tl + '_bloques_pendientes.txt' });
                            layoutDeferredCount += deferred.length;
                        }
                    } else if (fmt === 'pdf') {
                        blob = await trBuildPdf(outOrig, outTrans, bilingual);
                        ext = 'pdf';
                    } else {
                        blob = trBuildTxt(outOrig, outTrans, bilingual);
                        ext = 'txt';
                    }

                    const outName = item.file.name.replace(/\.pdf$/i, '')
                        + '_trad_' + tl + (fmt === 'pdf-layout' ? '_diseno' : '') + (bilingual ? '_bilingue' : '') + (cutInfo ? '_parcial' : '') + '.' + ext;
                    trResults.push({ blob, name: outName });
                    totalPagesDone += kept;
                    totalWordsDone += lastWords;
                } catch (err) {
                    console.error('Traducción fallida:', err);
                    failures.push(item.file.name + ': ' + err.message);
                }
                if (trCancelRequested) break;   // no iniciar el siguiente archivo
            }

            trCachePersist();
            setTrProgress(100, 'Completado');
            progressSectionTr.style.display = 'none';
            trCancelBtn.style.display = 'none';
            trProgressStats.textContent = '';

            const durAll = fmtEta((Date.now() - t0All) / 1000);
            if (trResults.length) {
                resultsSectionTr.style.display = 'block';
                let meta = trResults.length + ' archivo' + (trResults.length !== 1 ? 's' : '') + ' · ' + totalPagesDone + ' páginas · ' + fmtInt(totalWordsDone) + ' palabras · ' + durAll;
                if (trStopReason) meta += ' · PARCIAL (' + (trStopReason === 'cancelado' ? 'detenido' : 'servicio') + ')';
                if (layoutDeferredCount) meta += ' · ' + layoutDeferredCount + ' bloques conservados en original (traducción en TXT adjunto)';
                resultsMetaTr.textContent = meta;
                renderResultsList(filesListTr, trResults, '#10b981', globeIconSvg());
                if (trStopReason === 'cancelado') {
                    showToast('Traducción detenida: documento parcial guardado hasta donde llegó', '');
                } else if (trStopReason === 'servicio') {
                    showToast('El servicio de traducción dejó de responder: documento parcial guardado. Reintenta para continuar desde la caché.', 'error');
                } else if (trFailedSegments > 0) {
                    showToast(trFailedSegments + ' sección(es) no se pudieron traducir y se conservaron en el idioma original', 'error');
                } else {
                    showToast('Traducción completada', 'success');
                }
            } else {
                optionsSectionTr.style.display = 'block';
            }
            if (failures.length) {
                showToast(failures[0] + (failures.length > 1 ? ' (y ' + (failures.length - 1) + ' error' + (failures.length > 2 ? 'es' : '') + ' más)' : ''), 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error inesperado: ' + err.message, 'error');
            optionsSectionTr.style.display = 'block';
            progressSectionTr.style.display = 'none';
            trCancelBtn.style.display = 'none';
        } finally {
            isConvertingTr = false;
            trOcrTerminate();   // libera la memoria del motor OCR (se recarga al reiniciar)
            btnLabel.style.display = 'inline';
            btnSpinner.style.display = 'none';
            convertBtnTr.disabled = false;
        }
    }

    function resetTrMode() {
        trFiles = [];
        trResults = [];
        isConvertingTr = false;
        fileInputTr.value = '';
        uploadSectionTr.style.display = 'block';
        optionsSectionTr.style.display = 'none';
        progressSectionTr.style.display = 'none';
        resultsSectionTr.style.display = 'none';
        setTrProgress(0, '');
        trProgressStats.textContent = '';
        trCancelBtn.style.display = 'none';
        updateTrStatsBar();
    }
})();
