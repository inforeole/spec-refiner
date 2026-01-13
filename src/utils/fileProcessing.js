import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { MAX_TEXT_CONTENT_SIZE, MAX_IMAGE_DIMENSION, IMAGE_QUALITY } from './fileValidation';

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
 * Tronque un texte à une taille maximale en bytes
 * Coupe au dernier saut de ligne avant la limite
 * @param {string} text - Texte à tronquer
 * @param {number} maxBytes - Taille maximale en bytes
 * @returns {string}
 */
export const truncateText = (text, maxBytes = MAX_TEXT_CONTENT_SIZE) => {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);

    if (encoded.length <= maxBytes) {
        return text;
    }

    // Trouver la position de coupure
    let cutPosition = maxBytes;

    // Décoder jusqu'à la limite
    const decoder = new TextDecoder();
    let truncated = decoder.decode(encoded.slice(0, cutPosition));

    // Chercher le dernier saut de ligne pour couper proprement
    const lastNewline = truncated.lastIndexOf('\n');
    if (lastNewline > maxBytes * 0.8) {
        truncated = truncated.slice(0, lastNewline);
    }

    return truncated + '\n\n[... Document tronqué, suite non incluse ...]';
};

/**
 * Redimensionne une image si elle dépasse les dimensions maximales
 * @param {File} file - Fichier image
 * @param {number} maxDimension - Dimension maximale (largeur ou hauteur)
 * @param {number} quality - Qualité JPEG (0-1)
 * @returns {Promise<File>}
 */
export const resizeImage = async (file, maxDimension = MAX_IMAGE_DIMENSION, quality = IMAGE_QUALITY) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;

            // Vérifier si redimensionnement nécessaire
            if (width <= maxDimension && height <= maxDimension) {
                resolve(file);
                return;
            }

            // Calculer les nouvelles dimensions en gardant le ratio
            if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }

            // Créer le canvas et redimensionner
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convertir en blob
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Erreur lors du redimensionnement de l\'image'));
                        return;
                    }
                    // Créer un nouveau File avec le même nom
                    const resizedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(resizedFile);
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Erreur lors du chargement de l\'image'));
        };

        img.src = url;
    });
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
