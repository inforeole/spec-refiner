/**
 * Parse le contenu d'un message pour extraire les fichiers attachés
 * Format attendu: "Message\n\nDocuments attachés :\n\n--- filename.pdf ---\nContenu..."
 *
 * @param {string} content - Contenu brut du message
 * @returns {{ cleanContent: string, files: Array<{ name: string, content: string, type: string }> }}
 */
export function parseFileMarkers(content) {
    if (!content || typeof content !== 'string') {
        return { cleanContent: content || '', files: [] };
    }

    const files = [];

    // Pattern pour détecter les blocs fichiers: --- filename ---\ncontent
    const fileBlockRegex = /\n*--- ([^\n]+) ---\n([\s\S]*?)(?=\n--- [^\n]+ ---|\n*$)/g;

    // Cherche le début de la section "Documents attachés"
    const attachmentMarker = 'Documents attachés :';
    const markerIndex = content.indexOf(attachmentMarker);

    let cleanContent = content;

    if (markerIndex !== -1) {
        // Extrait le texte avant les documents
        cleanContent = content.substring(0, markerIndex).trim();

        // Extrait la partie avec les fichiers
        const filesSection = content.substring(markerIndex + attachmentMarker.length);

        let match;
        while ((match = fileBlockRegex.exec(filesSection)) !== null) {
            const fileName = match[1].trim();
            const fileContent = match[2].trim();

            // Détermine le type basé sur l'extension
            const ext = fileName.split('.').pop()?.toLowerCase() || '';
            const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);

            files.push({
                name: fileName,
                content: fileContent,
                type: isImage ? 'image' : 'text'
            });
        }
    }

    // Supprime aussi les résumés de fichiers [xxx] à la fin du message
    // Format: \n\n[Résumé du fichier] ou \n\n[Image]
    cleanContent = cleanContent.replace(/\n\n\[[^\]]+\]$/, '').trim();

    return { cleanContent, files };
}

/**
 * Extrait les URLs d'images depuis apiContent
 * @param {string|Array} apiContent - Contenu API du message
 * @returns {Array<{ url: string, name?: string }>}
 */
export function extractImageUrls(apiContent) {
    if (!apiContent || !Array.isArray(apiContent)) {
        return [];
    }

    return apiContent
        .filter(item => item.type === 'image_url' && item.image_url?.url)
        .map(item => ({ url: item.image_url.url }));
}
