/**
 * Utility functions for message processing
 */

import { isStorageUrl } from '../services/imageService';

/**
 * Extract Storage image URLs from messages
 * @param {Array} messages - Array of message objects
 * @returns {string[]} Array of Storage URLs (not base64)
 */
export function extractStorageImageUrls(messages) {
    return messages
        .flatMap(m => {
            if (!m.apiContent || !Array.isArray(m.apiContent)) return [];
            return m.apiContent
                .filter(c => c.type === 'image_url' && c.image_url?.url)
                .map(c => c.image_url.url);
        })
        .filter(isStorageUrl);
}
