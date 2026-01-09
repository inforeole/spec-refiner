import { useState, useCallback } from 'react';
import { processFiles } from '../utils/fileProcessing';

/**
 * Hook pour gérer l'input du chat (message + fichiers)
 * @returns {Object} États et handlers pour le chat input
 */
export function useChatInput() {
    const [inputMessage, setInputMessage] = useState('');
    const [chatFiles, setChatFiles] = useState([]);
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);

    const handleFileSelect = useCallback((e) => {
        const selectedFiles = Array.from(e.target?.files || e.dataTransfer?.files || []);
        setChatFiles(prev => [...prev, ...selectedFiles]);
    }, []);

    const removeFile = useCallback((index) => {
        setChatFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    const clearInput = useCallback(() => {
        setInputMessage('');
        setChatFiles([]);
    }, []);

    const addFiles = useCallback((files) => {
        setChatFiles(prev => [...prev, ...files]);
    }, []);

    /**
     * Traite les fichiers pour l'API (extraction contenu, upload images)
     * @param {File[]} files - Fichiers à traiter
     * @returns {Promise<Array>} Fichiers traités avec type et contenu
     */
    const processCurrentFiles = useCallback(async (files) => {
        setIsProcessingFiles(true);
        try {
            const processed = await processFiles(files);
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
        processCurrentFiles
    };
}
