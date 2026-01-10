import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

/**
 * Wraps a promise with a timeout
 */
export const withTimeout = (promise, timeoutMs, errorMessage) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
};

/**
 * Generic file reader wrapper
 * @param {File} file - File to read
 * @param {'readAsDataURL'|'readAsText'|'readAsArrayBuffer'} method - FileReader method to use
 */
const readFile = (file, method) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
        reader[method](file);
    });
};

/** Read a file as base64 data URL */
export const readFileAsBase64 = (file) => readFile(file, 'readAsDataURL');

/** Read a file as text */
export const readFileAsText = (file) => readFile(file, 'readAsText');

/** Read a file as ArrayBuffer */
export const readFileAsArrayBuffer = (file) => readFile(file, 'readAsArrayBuffer');

/**
 * Process an image file and return base64 data
 */
export const processImageFile = async (file) => {
    const base64 = await withTimeout(
        readFileAsBase64(file),
        30000,
        'Délai dépassé pour la lecture de l\'image'
    );
    if (!base64 || !base64.startsWith('data:image/')) {
        throw new Error('Format image invalide');
    }
    return {
        type: 'image',
        name: file.name,
        content: base64,
        mimeType: file.type
    };
};

/**
 * Process a PDF file and extract text
 */
export const processPdfFile = async (file, arrayBuffer = null) => {
    if (!arrayBuffer) {
        arrayBuffer = await withTimeout(
            readFileAsArrayBuffer(file),
            30000,
            'Délai dépassé pour la lecture du PDF'
        );
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await withTimeout(
        loadingTask.promise,
        60000,
        'Délai dépassé pour l\'analyse du PDF'
    );

    let fullText = `[Document PDF: ${file.name}]\n`;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        let pageText = '';
        let lastY = null;
        for (const item of textContent.items) {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                pageText += '\n';
            }
            pageText += item.str + ' ';
            lastY = item.transform[5];
        }

        fullText += `\n--- Page ${i}/${pdf.numPages} ---\n${pageText.trim()}`;
    }

    if (fullText.trim().length < 50) {
        fullText += '\n\n[Note: Ce PDF semble contenir peu de texte extractible. Il peut s\'agir d\'un document scanné ou principalement composé d\'images.]';
    }

    return {
        type: 'text',
        name: file.name,
        content: fullText
    };
};

/**
 * Process a DOCX file and extract text
 */
export const processDocxFile = async (file, arrayBuffer = null) => {
    if (!arrayBuffer) {
        arrayBuffer = await withTimeout(
            readFileAsArrayBuffer(file),
            30000,
            'Délai dépassé pour la lecture du document Word'
        );
    }
    const result = await mammoth.extractRawText({ arrayBuffer });
    return {
        type: 'text',
        name: file.name,
        content: `[Document Word: ${file.name}]\n\n${result.value}`
    };
};

/**
 * Process a text file
 */
export const processTextFile = async (file) => {
    const text = await withTimeout(
        readFileAsText(file),
        30000,
        'Délai dépassé pour la lecture du fichier'
    );
    return {
        type: 'text',
        name: file.name,
        content: `[Fichier: ${file.name}]\n\n${text}`
    };
};

/**
 * Process multiple files
 */
export const processFiles = async (filesToProcess) => {
    const fileData = [];

    for (const file of filesToProcess) {
        try {
            if (file.type.startsWith('image/')) {
                fileData.push(await processImageFile(file));
            } else if (file.type === 'application/pdf') {
                fileData.push(await processPdfFile(file));
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                fileData.push(await processDocxFile(file));
            } else {
                fileData.push(await processTextFile(file));
            }
        } catch (error) {
            fileData.push({
                type: 'text',
                name: file.name,
                content: `[Erreur lors de la lecture de ${file.name}: ${error.message}]`
            });
        }
    }

    return fileData;
};
