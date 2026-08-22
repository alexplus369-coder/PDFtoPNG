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
    // 2. MODO: UNIR PDF (MERGE)
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
    // 3. MODO: DIVIDIR PDF (SPLIT)
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
    // 4. MODO: RENOMBRAR ARCHIVOS
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
    // 5. MODO: WORD A PDF
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
            showToast('Leyendo archivo Word...');
            const buffer = await wordFile.arrayBuffer();
            mammoth.extractRawText({ arrayBuffer: buffer }).then(result => {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                const lines = doc.splitTextToSize(result.value, 180);
                doc.text(lines, 15, 15);
                doc.save(wordFile.name.replace(/\.[^/.]+$/, '') + '.pdf');
                showToast('¡Word convertido a PDF!', 'success');
            }).catch(err => showToast('Error al leer Word', 'error'));
        });
    }

    // ============================================================
    // 6. MODO: PDF A WORD / TEXTO
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
        });
    }
})();
