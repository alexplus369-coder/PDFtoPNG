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
    const TR_PROXY_URL = 'https://pd-fto-png.vercel.app/api/translate';                            // opcional: URL de un proxy propio en Vercel (ver carpeta opcional-vercel/)
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

    async function trExtractPdf(file, onProgress) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = [];
        let totalChars = 0;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const lines = groupTextItemsIntoLines(textContent.items);

            const paragraphs = [];
            let buf = '';
            let prevY = null;

            lines.forEach(line => {
                const text = trLineText(line);
                if (prevY !== null && (prevY - line.y) > line.avgHeight * 1.9) {
                    if (buf.trim()) paragraphs.push(buf.trim());
                    buf = '';
                }
                if (text) {
                    // reconstruir palabras cortadas por guion al final de línea
                    if (buf.endsWith('-') && /^[a-záéíóúñüàèìòùâêîôûäëïöçãõ]./.test(text)) {
                        buf = buf.replace(/-$/, '') + text;
                    } else {
                        buf = buf ? buf + ' ' + text : text;
                    }
                } else if (buf.trim()) {
                    paragraphs.push(buf.trim());
                    buf = '';
                }
                prevY = line.y;
            });
            if (buf.trim()) paragraphs.push(buf.trim());

            paragraphs.forEach(p => { totalChars += p.length; });
            pages.push({ paragraphs });
            if (onProgress) onProgress(pageNum / pdf.numPages);
        }

        return { pages, hasText: totalChars >= 20 };
    }

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
        if (item.error === 'escaneado') return { text: 'Sin texto seleccionable (escaneo) — no traducible', warn: true };
        if (item.error === 'lectura') return { text: 'No se pudo leer el PDF', warn: true };
        if (item.doc) {
            const est = (item.uniq || 0) / 4.5 + item.doc.pages.length * 0.3;
            const w = item.words || 0;
            return {
                text: item.doc.pages.length + (item.doc.pages.length === 1 ? ' página · ' : ' páginas · ')
                    + w.toLocaleString('es') + (w === 1 ? ' palabra · ' : ' palabras · ')
                    + '≈ ' + trFmtMin(est * 0.7) + ' – ' + trFmtMin(est * 1.9),
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
        if (scanned) parts.push(scanned + ' sin texto (no traducible)');
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
        const fmt = trFormatSelector.querySelector('.segment.active').dataset.value;
        const bilingual = bilingualCheckTr.checked;
        const slSetting = sourceLangSelect.value;
        const tl = targetLangSelect.value;
        const failures = [];
        const t0All = Date.now();
        let totalPagesDone = 0;
        let totalWordsDone = 0;

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

                    if (!doc.hasText) {
                        throw new Error('"' + item.file.name + '" no contiene texto seleccionable (parece un escaneo). El traductor necesita PDFs con texto real.');
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
                    } else if (fmt === 'pdf') {
                        blob = await trBuildPdf(outOrig, outTrans, bilingual);
                        ext = 'pdf';
                    } else {
                        blob = trBuildTxt(outOrig, outTrans, bilingual);
                        ext = 'txt';
                    }

                    const outName = item.file.name.replace(/\.pdf$/i, '')
                        + '_trad_' + tl + (bilingual ? '_bilingue' : '') + (cutInfo ? '_parcial' : '') + '.' + ext;
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
