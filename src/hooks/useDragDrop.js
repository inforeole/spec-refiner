import { useState, useCallback } from 'react';

/**
 * Hook réutilisable pour gérer le drag & drop de fichiers
 * @param {Object} options
 * @param {Function} options.onDrop - Callback appelé avec les fichiers déposés
 * @param {boolean} options.disabled - Si true, désactive le drag & drop
 * @returns {Object} { isDragging, dragHandlers }
 */
export function useDragDrop({ onDrop, disabled = false }) {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            setIsDragging(true);
        }
    }, [disabled]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if leaving the main container
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (disabled) return;

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0 && onDrop) {
            onDrop(droppedFiles);
        }
    }, [disabled, onDrop]);

    return {
        isDragging,
        dragHandlers: {
            onDragOver: handleDragOver,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop
        }
    };
}
