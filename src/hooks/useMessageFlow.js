/**
 * Hook for orchestrating message sending flow
 * Handles validation, input clearing, file processing, and sending
 */

import { useCallback } from 'react';

export function useMessageFlow({ chatInput, interviewChat }) {
    const { inputMessage, chatFiles, clearInput, processCurrentFiles } = chatInput;
    const { isLoading, sendMessage } = interviewChat;

    const handleSendMessage = useCallback(async () => {
        // Validate: need either text or files, and not loading
        if ((!inputMessage.trim() && chatFiles.length === 0) || isLoading) return;

        // Capture current values before clearing
        const messageText = inputMessage;
        const currentFiles = [...chatFiles];

        // Clear input immediately for better UX
        clearInput();

        // Process files if any
        const processedFiles = currentFiles.length > 0
            ? await processCurrentFiles(currentFiles)
            : [];

        // Send the message
        await sendMessage(messageText, processedFiles);
    }, [inputMessage, chatFiles, isLoading, clearInput, processCurrentFiles, sendMessage]);

    return { handleSendMessage };
}
