(() => {
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const toastEl = $('#toast');

    function showToast(msg, type = '') {
        if (!toastEl) return;
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

            modeBtns.forEach(b => b.classList.remove('active'));
            clickedBtn.classList.add('active');

            const mainPanels = document.querySelectorAll('main > div');
            mainPanels.forEach(panel => panel.style.display = 'none');

            let targetPanelId = 'pdf2imgPanel';
            if (targetMode === 'img2pdf') targetPanelId = 'img2pdfPanel';
            else if (targetMode === 'mergepdf') targetPanelId = 'mergePdfPanel';
            else if (targetMode === 'splitpdf') targetPanelId = 'splitPdfPanel';
            else if (targetMode === 'renamefiles') targetPanelId = 'renameFilesPanel';
            else if (targetMode === 'word2pdf') targetPanelId = 'word2pdfPanel';
            else if (targetMode === 'pdf2word') targetPanelId = 'pdf2wordPanel';

            const activePanel = document.getElementById(targetPanelId);
            if (activePanel) activePanel.style.display = 'block';
        });
    });

    // ============================================================
    // 1. MODO: PDF → IMAGEN
    // ============================================================
    const dropZonePdf = $('#dropZonePdf'), fileInputPdf = $('#fileInputPdf');
    const uploadSectionPdf = $('#uploadSectionPdf'), optionsSectionPdf = $('#optionsSectionPdf');
    const progressSectionPdf = $('#progressSectionPdf'), resultsSectionPdf = $('#resultsSectionPdf');
    const fileNamePdf = $('#fileNamePdf'), filePagesPdf = $('#filePagesPdf'), removeFilePdf = $('#removeFilePdf');
    const formatSelectorPdf = $('#formatSelectorPdf'), qualityRangePdf = $('#qualityRangePdf'), qualityValuePdf = $('#qualityValuePdf');
    const scaleSelectPdf = $('#scaleSelectPdf'), convertBtnPdf = $('#convertBtnPdf'), pagesListPdf = $('#pagesListPdf');
    const downloadZipBtnPdf = $('#downloadZipBtnPdf');

    let pdfDocument = null, convertedPagesPdf = [];

    if (dropZonePdf && fileInputPdf) {
        dropZonePdf.addEventListener('click', () => fileInputPdf.click());
        fileInputPdf.addEventListener('change', (e) => { if (e.target.files[0]) handlePdfFile(e.target.files[0]); });
    }
    if (removeFilePdf && uploadSectionPdf && optionsSectionPdf) {
        removeFilePdf.addEventListener('click', () => { uploadSectionPdf.style.display='block'; optionsSectionPdf.style.display='none'; });
    }
    if (qualityRangePdf && qualityValuePdf) {
        qualityRangePdf.addEventListener('input', (e) => qualityValuePdf.textContent = e.target.value + '%');
    }
    if (formatSelectorPdf && qualityRangePdf) {
        formatSelectorPdf.querySelectorAll('.segment').forEach(btn => {
            btn.addEventListener('click', () => {
                formatSelectorPdf.querySelectorAll('.segment').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                qualityRangePdf.disabled = btn.dataset.value !== 'jpeg';
            });
        });
    }

    async function handlePdfFile(file) {
        if (file.type !== 'application/pdf') return showToast('No es un PDF válido', 'error');
        if (fileNamePdf) fileNamePdf.textContent = file.name;
        const buffer = await file.arrayBuffer();
        pdfDocument = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (filePagesPdf) filePagesPdf.textContent = `${pdfDocument.numPages} páginas`;
        if (uploadSectionPdf) uploadSectionPdf.style.display = 'none';
        if (optionsSectionPdf) optionsSectionPdf.style.display = 'block';
    }

    if (convertBtnPdf) {
        convertBtnPdf.addEventListener('click', async () => {
            if (!pdfDocument) return;
            if (optionsSectionPdf) optionsSectionPdf.style.display = 'none';
            if (progressSectionPdf) progressSectionPdf.style.display = 'block';
            const scale = scaleSelectPdf ? parseFloat(scaleSelectPdf.value) : 2;
            const formatNode = formatSelectorPdf ? formatSelectorPdf.querySelector('.segment.active') : null;
            const format = formatNode ? formatNode.dataset.value : 'png';
            const quality = qualityRangePdf ? parseInt(qualityRangePdf.value) / 100 : 0.9;
            const zip = new JSZip();
            convertedPagesPdf = [];

            for (let i = 1; i <= pdfDocument.numPages; i++) {
                const page = await pdfDocument.getPage(i);
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width; canvas.height = viewport.height;
                if (format === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); }
                await page.render({ canvasContext: ctx, viewport }).promise;
                const blob = await new Promise(res => canvas.toBlob(res, `image/${format}`, quality));
                const url = URL.createObjectURL(blob);
                convertedPagesPdf.push({ blob, url, pageNum: i, format });
                zip.file(`pagina-${String(i).padStart(3, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`, blob);
            }

            if (progressSectionPdf) progressSectionPdf.style.display = 'none';
            if (resultsSectionPdf) resultsSectionPdf.style.display = 'block';
            if (pagesListPdf) {
                pagesListPdf.innerHTML = '';
                convertedPagesPdf.forEach((p, idx) => {
                    pagesListPdf.innerHTML += `<div class="page-card"><img src="${p.url}" class="page-thumb"><div class="page-footer"><span>Pág ${p.pageNum}</span><button class="page-dl" onclick="saveAs(convertedPagesPdf[${idx}].blob, 'pagina-${p.pageNum}.${p.format}')">Descargar</button></div></div>`;
                });
            }
            if (downloadZipBtnPdf) {
                downloadZipBtnPdf.onclick = async () => saveAs(await zip.generateAsync({type:'blob'}), 'pdf-imagenes.zip');
            }
        });
    }

    // ============================================================
    // 2. MODO: IMAGEN → PDF
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
    const convertBtnImg = $('#convertBtnImg');
    const pdfFileName = $('#pdfFileName');
    const downloadPdfBtn = $('#downloadPdfBtn');

    let imageFiles = [];
    let isGeneratingPdf = false;

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
            else showToast('Solo se permiten imágenes válidas', 'error');
        });
    }

    if (removeFileImg) removeFileImg.addEventListener('click', resetImgMode);
    if (convertBtnImg) convertBtnImg.addEventListener('click', startImgToPdf);

    function handleImageFiles(files) {
        const valid = files.filter(f => f.type.startsWith('image/'));
        if (!valid.length) {
            showToast('Selecciona imágenes válidas (PNG, JPG)', 'error');
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
            div.innerHTML = `
                <img src="${item.url}" class="queue-thumb" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">
                <span class="queue-name" style="flex:1;margin-left:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.file.name}</span>
                <button class="queue-btn delete" data-id="${item.id}" style="background:#ef4444;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">✕</button>
            `;
            imageQueue.appendChild(div);
        });

        imageQueue.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const idx = imageFiles.findIndex(i => i.id === id);
                if (idx !== -1) {
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
            if (fileNameImg) fileNameImg.textContent = `${count} imagen${count !== 1 ? 'es' : ''} seleccionada${count !== 1 ? 's' : ''}`;
            if (uploadSectionImg) uploadSectionImg.style.display = 'none';
            if (optionsSectionImg) optionsSectionImg.style.display = 'block';
        } else {
            resetImgMode();
        }
    }

    async function startImgToPdf() {
        if (!imageFiles.length || isGeneratingPdf) return;
        isGeneratingPdf = true;

        if (optionsSectionImg) optionsSectionImg.style.display = 'none';
        if (progressSectionImg) progressSectionImg.style.display = 'block';

        try {
            const { jsPDF } = window.jspdf;
            const pageSize = pageSizeSelect ? pageSizeSelect.value : 'a4';
            const orientation = orientationSelect ? orientationSelect.value : 'portrait';

            const doc = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: pageSize === 'a4' ? 'a4' : 'letter'
            });

            for (let i = 0; i < imageFiles.length; i++) {
                if (i > 0) doc.addPage();
                const item = imageFiles[i];
                const imgData = await fileToBase64(item.file);
                
                const pw = doc.internal.pageSize.getWidth();
                const ph = doc.internal.pageSize.getHeight();
                
                doc.addImage(imgData, 'JPEG', 10, 10, pw - 20, ph - 20, undefined, 'FAST');
            }

            const pdfBlob = doc.output('blob');
            if (progressSectionImg) progressSectionImg.style.display = 'none';
            if (resultsSectionImg) resultsSectionImg.style.display = 'block';

            if (pdfFileName) pdfFileName.textContent = 'imagenes-unidas.pdf';
            if (downloadPdfBtn) {
                downloadPdfBtn.onclick = () => saveAs(pdfBlob, 'imagenes-unidas.pdf');
            }
            showToast('¡PDF generado con éxito!', 'success');
        } catch (err) {
            showToast('Error al generar PDF', 'error');
            if (optionsSectionImg) optionsSectionImg.style.display = 'block';
            if (progressSectionImg) progressSectionImg.style.display = 'none';
        } finally {
            isGeneratingPdf = false;
        }
    }

    function resetImgMode() {
        imageFiles.forEach(i => URL.revokeObjectURL(i.url));
        imageFiles = [];
        if (fileInputImg) fileInputImg.value = '';
        if (uploadSectionImg) uploadSectionImg.style.display = 'block';
        if (optionsSectionImg) optionsSectionImg.style.display = 'none';
        if (progressSectionImg) progressSectionImg.style.display = 'none';
        if (resultsSectionImg) resultsSectionImg.style.display = 'none';
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ============================================================
    // 3. MODO: UNIR PDF (MERGE)
    // ============================================================
    const dropZoneMerge = $('#dropZoneMerge'), fileInputMerge = $('#fileInputMerge');
    const optionsSectionMerge = $('#optionsSectionMerge'), mergeQueue = $('#mergeQueue'), convertBtnMerge = $('#convertBtnMerge');
    let mergeFiles = [];

    if (dropZoneMerge && fileInputMerge) {
        dropZoneMerge.addEventListener('click', () => fileInputMerge.click());
        fileInputMerge.addEventListener('change', (e) => {
            mergeFiles = Array.from(e.target.files);
            if (mergeFiles.length) {
                if (optionsSectionMerge) optionsSectionMerge.style.display = 'block';
                if (mergeQueue) mergeQueue.innerHTML = mergeFiles.map(f => `<div class="queue-item"><span class="queue-name">${f.name}</span></div>`).join('');
            }
        });
    }

    if (convertBtnMerge) {
        convertBtnMerge.addEventListener('click', async () => {
            if (!mergeFiles.length) return;
            showToast('Uniendo PDFs...');
            const mergedPdf = await PDFLib.PDFDocument.create();
            for (let file of mergeFiles) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach(page => mergedPdf.addPage(page));
            }
            const pdfBytes = await mergedPdf.save();
            saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), 'documento-unido.pdf');
            showToast('¡PDF unido con éxito!', 'success');
        });
    }

    // ============================================================
    // 4. MODO: DIVIDIR PDF (SPLIT)
    // ============================================================
    const dropZoneSplit = $('#dropZoneSplit'), fileInputSplit = $('#fileInputSplit');
    const optionsSectionSplit = $('#optionsSectionSplit'), fileNameSplit = $('#fileNameSplit'), convertBtnSplit = $('#convertBtnSplit');
    let splitFile = null;

    if (dropZoneSplit && fileInputSplit) {
        dropZoneSplit.addEventListener('click', () => fileInputSplit.click());
        fileInputSplit.addEventListener('change', (e) => {
            splitFile = e.target.files[0];
            if (splitFile) {
                if (fileNameSplit) fileNameSplit.textContent = splitFile.name;
                if (optionsSectionSplit) optionsSectionSplit.style.display = 'block';
            }
        });
    }

    if (convertBtnSplit) {
        convertBtnSplit.addEventListener('click', async () => {
            if (!splitFile) return;
            showToast('Dividiendo PDF en páginas...');
            const arrayBuffer = await splitFile.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            const zip = new JSZip();
            const numPages = pdf.getPageCount();

            for (let i = 0; i < numPages; i++) {
                const subPdf = await PDFLib.PDFDocument.create();
                const [copiedPage] = await subPdf.copyPages(pdf, [i]);
                subPdf.addPage(copiedPage);
                const bytes = await subPdf.save();
                zip.file(`pagina-${i + 1}.pdf`, bytes);
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, 'pdf-dividido.zip');
            showToast('¡PDF dividido y comprimido!', 'success');
        });
    }

    // ============================================================
    // 5. MODO: RENOMBRAR ARCHIVOS
    // ============================================================
    const dropZoneRename = $('#dropZoneRename'), fileInputRename = $('#fileInputRename');
    const optionsSectionRename = $('#optionsSectionRename'), renameQueue = $('#renameQueue'), renamePrefix = $('#renamePrefix'), convertBtnRename = $('#convertBtnRename');
    let renameFiles = [];

    if (dropZoneRename && fileInputRename) {
        dropZoneRename.addEventListener('click', () => fileInputRename.click());
        fileInputRename.addEventListener('change', (e) => {
            renameFiles = Array.from(e.target.files);
            if (renameFiles.length) {
                if (optionsSectionRename) optionsSectionRename.style.display = 'block';
                renderRenameQueue();
            }
        });
    }
    if (renamePrefix) renamePrefix.addEventListener('input', renderRenameQueue);

    function renderRenameQueue() {
        if (!renameQueue) return;
        const prefix = renamePrefix ? renamePrefix.value || 'archivo_' : 'archivo_';
        renameQueue.innerHTML = renameFiles.map((f, idx) => `
            <div class="queue-item">
                <span class="queue-name">${f.name}</span>
                <span class="queue-newname">➔ ${prefix}${idx + 1}.${f.name.split('.').pop()}</span>
            </div>
        `).join('');
    }

    if (convertBtnRename) {
        convertBtnRename.addEventListener('click', async () => {
            const prefix = renamePrefix ? renamePrefix.value || 'archivo_' : 'archivo_';
            const zip = new JSZip();
            renameFiles.forEach((f, idx) => {
                const ext = f.name.split('.').pop();
                zip.file(`${prefix}${idx + 1}.${ext}`, f);
            });
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, 'archivos-renombrados.zip');
            showToast('¡Archivos renombrados!', 'success');
        });
    }

    // ============================================================
    // 6. MODO: WORD A PDF (CON SALTO DE PÁGINA AUTOMÁTICO)
    // ============================================================
    const dropZoneWord = $('#dropZoneWord'), fileInputWord = $('#fileInputWord');
    const optionsSectionWord = $('#optionsSectionWord'), fileNameWord = $('#fileNameWord'), convertBtnWord = $('#convertBtnWord');
    let wordFile = null;

    if (dropZoneWord && fileInputWord) {
        dropZoneWord.addEventListener('click', () => fileInputWord.click());
        fileInputWord.addEventListener('change', (e) => {
            wordFile = e.target.files[0];
            if (wordFile) {
                if (fileNameWord) fileNameWord.textContent = wordFile.name;
                if (optionsSectionWord) optionsSectionWord.style.display = 'block';
            }
        });
    }

    if (convertBtnWord) {
        convertBtnWord.addEventListener('click', async () => {
            if (!wordFile) return;
            showToast('Convirtiendo Word a PDF...');
            try {
                const buffer = await wordFile.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer: buffer });
                
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                const pageWidth = 180; 
                const pageHeight = 270; 
                let y = 15; 
                
                const lines = doc.splitTextToSize(result.value, pageWidth);
                
                lines.forEach((line) => {
                    if (y > pageHeight) {
                        doc.addPage(); 
                        y = 15; 
                    }
                    doc.text(line, 15, y);
                    y += 7; 
                });

                doc.save(wordFile.name.replace(/\.[^/.]+$/, '') + '.pdf');
                showToast('¡Word convertido con éxito a PDF!', 'success');
            } catch (err) {
                showToast('Error al convertir el archivo Word', 'error');
            }
        });
    }

    // ============================================================
    // 7. MODO: PDF A WORD / TEXTO
    // ============================================================
    const dropZonePdf2Word = $('#dropZonePdf2Word'), fileInputPdf2Word = $('#fileInputPdf2Word');
    const optionsSectionPdf2Word = $('#optionsSectionPdf2Word'), fileNamePdf2Word = $('#fileNamePdf2Word'), convertBtnPdf2Word = $('#convertBtnPdf2Word');
    let pdf2WordFile = null;

    if (dropZonePdf2Word && fileInputPdf2Word) {
        dropZonePdf2Word.addEventListener('click', () => fileInputPdf2Word.click());
        fileInputPdf2Word.addEventListener('change', (e) => {
            pdf2WordFile = e.target.files[0];
            if (pdf2WordFile) {
                if (fileNamePdf2Word) fileNamePdf2Word.textContent = pdf2WordFile.name;
                if (optionsSectionPdf2Word) optionsSectionPdf2Word.style.display = 'block';
            }
        });
    }

    if (convertBtnPdf2Word) {
        convertBtnPdf2Word.addEventListener('click', async () => {
            if (!pdf2WordFile) return;
            showToast('Extrayendo texto del PDF...');
            try {
                const buffer = await pdf2WordFile.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += `--- Página ${i} ---\n\n${pageText}\n\n`;
                }
                const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
                saveAs(blob, pdf2WordFile.name.replace(/\.[^/.]+$/, '') + '.doc');
                showToast('¡Texto extraído con éxito!', 'success');
            } catch (err) {
                showToast('Error al extraer texto del PDF', 'error');
            }
        });
    }
})();
