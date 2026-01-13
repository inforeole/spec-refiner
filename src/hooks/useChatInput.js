import { useState, useCallback } from 'react';
import { processFiles, truncateText, resizeImage, processPdfFile, processDocxFile, processTextFile } from '../utils/fileProcessing';
import { validateFileSize, validateTextContent, isImageFile, isTextFile } from '../utils/fileValidation';

/**
 * Hook pour gérer l'input du chat (message + fichiers)
 * Limité à 1 fichier à la fois, avec validation de taille
 * @returns {Object} États et handlers pour le chat input
 */
export function useChatInput() {
    const [inputMessage, setInputMessage] = useState('');
    const [chatFiles, setChatFiles] = useState([]);
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);

    // État pour le dialogue de validation
    const [validationDialog, setValidationDialog] = useState({
        isOpen: false,
        type: null, // 'file-too-large' | 'text-too-large' | 'image-too-large'
        file: null,
        extractedContent: null,
        fileSize: '',
        extractedSize: ''
    });

    /**
     * Extrait le contenu texte d'un fichier pour validation
     */
    const extractTextContent = useCallback(async (file) => {
        if (file.type === 'application/pdf') {
            const result = await processPdfFile(file);
            return result.content;
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await processDocxFile(file);
            return result.content;
        } else {
            const result = await processTextFile(file);
            return result.content;
        }
    }, []);

    /**
     * Valide un fichier et retourne le type de dialogue à afficher si nécessaire
     */
    const validateFile = useCallback(async (file) => {
        const sizeValidation = validateFileSize(file);

        // Fichier trop gros (> 5MB)
        if (!sizeValidation.valid) {
            return {
                needsDialog: true,
                dialogType: 'file-too-large',
                fileSize: sizeValidation.sizeFormatted
            };
        }

        // Image : vérifier si > 5MB (déjà fait ci-dessus, donc OK)
        if (isImageFile(file)) {
            // Vérifier si l'image est grande (> 5MB déjà géré, mais on peut aussi checker dimensions)
            // Pour l'instant on accepte les images < 5MB directement
            // Le redimensionnement sera fait si nécessaire lors du process
            return { needsDialog: false };
        }

        // Fichier texte : extraire et vérifier la taille du contenu
        if (isTextFile(file)) {
            try {
                const extractedContent = await extractTextContent(file);
                const contentValidation = validateTextContent(extractedContent);

                if (contentValidation.needsTruncation) {
                    return {
                        needsDialog: true,
                        dialogType: 'text-too-large',
                        fileSize: sizeValidation.sizeFormatted,
                        extractedSize: contentValidation.sizeFormatted,
                        extractedContent
                    };
                }

                // Contenu OK, stocker pour éviter re-extraction
                return {
                    needsDialog: false,
                    extractedContent
                };
            } catch (error) {
                // En cas d'erreur d'extraction, laisser passer (l'erreur sera gérée plus tard)
                console.warn('Erreur lors de l\'extraction pour validation:', error);
                return { needsDialog: false };
            }
        }

        return { needsDialog: false };
    }, [extractTextContent]);

    /**
     * Gère la sélection d'un fichier avec validation
     */
    const handleFileSelect = useCallback(async (e) => {
        const selectedFiles = Array.from(e.target?.files || e.dataTransfer?.files || []);
        if (selectedFiles.length === 0) return;

        const file = selectedFiles[0];
        setIsProcessingFiles(true);

        try {
            const validation = await validateFile(file);

            if (validation.needsDialog) {
                setValidationDialog({
                    isOpen: true,
                    type: validation.dialogType,
                    file,
                    extractedContent: validation.extractedContent || null,
                    fileSize: validation.fileSize,
                    extractedSize: validation.extractedSize || ''
                });
            } else {
                // Fichier OK, ajouter avec contenu pré-extrait si disponible
                if (validation.extractedContent) {
                    file._extractedContent = validation.extractedContent;
                }
                setChatFiles([file]);
            }
        } finally {
            setIsProcessingFiles(false);
        }
    }, [validateFile]);

    /**
     * Action du dialogue (tronquer/redimensionner)
     */
    const handleValidationAction = useCallback(async () => {
        const { type, file, extractedContent } = validationDialog;

        if (type === 'text-too-large' && extractedContent) {
            // Tronquer le contenu et ajouter le fichier
            const truncatedContent = truncateText(extractedContent);
            file._extractedContent = truncatedContent;
            file._wasTruncated = true;
            setChatFiles([file]);
        } else if (type === 'image-too-large') {
            // Redimensionner l'image
            setIsProcessingFiles(true);
            try {
                const resizedFile = await resizeImage(file);
                resizedFile._wasResized = true;
                setChatFiles([resizedFile]);
            } catch (error) {
                console.error('Erreur lors du redimensionnement:', error);
            } finally {
                setIsProcessingFiles(false);
            }
        }

        setValidationDialog({ isOpen: false, type: null, file: null, extractedContent: null, fileSize: '', extractedSize: '' });
    }, [validationDialog]);

    /**
     * Annuler le dialogue (ne pas ajouter le fichier)
     */
    const handleValidationCancel = useCallback(() => {
        setValidationDialog({ isOpen: false, type: null, file: null, extractedContent: null, fileSize: '', extractedSize: '' });
    }, []);

    const removeFile = useCallback(() => {
        setChatFiles([]);
    }, []);

    const clearInput = useCallback(() => {
        setInputMessage('');
        setChatFiles([]);
    }, []);

    const addFiles = useCallback(async (files) => {
        if (files.length === 0) return;

        const file = files[0];
        setIsProcessingFiles(true);

        try {
            const validation = await validateFile(file);

            if (validation.needsDialog) {
                setValidationDialog({
                    isOpen: true,
                    type: validation.dialogType,
                    file,
                    extractedContent: validation.extractedContent || null,
                    fileSize: validation.fileSize,
                    extractedSize: validation.extractedSize || ''
                });
            } else {
                if (validation.extractedContent) {
                    file._extractedContent = validation.extractedContent;
                }
                setChatFiles([file]);
            }
        } finally {
            setIsProcessingFiles(false);
        }
    }, [validateFile]);

    /**
     * Traite les fichiers pour l'API (extraction contenu, upload images)
     * Utilise le contenu pré-extrait si disponible
     * @param {File[]} files - Fichiers à traiter
     * @returns {Promise<Array>} Fichiers traités avec type et contenu
     */
    const processCurrentFiles = useCallback(async (files) => {
        setIsProcessingFiles(true);
        try {
            const processed = [];
            for (const file of files) {
                // Si le contenu a été pré-extrait (et potentiellement tronqué), l'utiliser
                if (file._extractedContent) {
                    processed.push({
                        type: 'text',
                        name: file.name,
                        content: file._extractedContent,
                        wasTruncated: file._wasTruncated || false
                    });
                } else {
                    // Sinon, traiter normalement
                    const results = await processFiles([file]);
                    processed.push(...results);
                }
            }
            return processed;
        } finally {
            setIsProcessingFiles(false);
        }
    }, []);

    return {
        inputMessage,
        setInputMessage,
        chatFiles,
        setChatFiles,
        isProcessingFiles,
        handleFileSelect,
        removeFile,
        clearInput,
        addFiles,
        processCurrentFiles,
        // Nouveau : état et handlers pour le dialogue de validation
        validationDialog,
        handleValidationAction,
        handleValidationCancel
    };
}
