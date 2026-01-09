/**
 * Image upload service for Supabase Storage
 * Handles uploading images and converting base64 to URLs
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BUCKET_NAME = 'specrefiner_images';

/**
 * Upload a base64 image to Supabase Storage
 * @param {string} base64Data - Base64 encoded image (with or without data URL prefix)
 * @param {string} filename - Optional filename
 * @returns {Promise<{url: string|null, error: string|null}>}
 */
export async function uploadImage(base64Data, filename = null) {
    if (!isSupabaseConfigured()) {
        return { url: null, error: 'Supabase non configuré' };
    }

    try {
        // Extract base64 content and mime type
        let base64Content = base64Data;
        let mimeType = 'image/png';

        if (base64Data.startsWith('data:')) {
            const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Content = matches[2];
            }
        }

        // Convert base64 to blob
        const byteCharacters = atob(base64Content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Generate unique filename
        const extension = mimeType.split('/')[1] || 'png';
        const uniqueFilename = filename || `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uniqueFilename, blob, {
                contentType: mimeType,
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

        return { url: urlData.publicUrl, error: null };
    } catch (e) {
        console.error('Image upload failed:', e);
        return { url: null, error: `Erreur d'upload: ${e.message}` };
    }
}

/**
 * Upload multiple images and return URLs
 * @param {Array<{base64: string, filename?: string}>} images
 * @returns {Promise<Array<{url: string|null, error: string|null}>>}
 */
export async function uploadImages(images) {
    return Promise.all(images.map(img => uploadImage(img.base64, img.filename)));
}

/**
 * Delete an image from Supabase Storage
 * @param {string} url - Public URL of the image
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function deleteImage(url) {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase non configuré' };
    }

    try {
        // Extract path from URL
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
        if (!pathMatch) {
            return { success: false, error: 'URL invalide' };
        }

        const filePath = pathMatch[1];

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (error) throw error;
        return { success: true, error: null };
    } catch (e) {
        console.error('Image delete failed:', e);
        return { success: false, error: `Erreur de suppression: ${e.message}` };
    }
}

/**
 * Check if a string is a base64 image
 * @param {string} str
 * @returns {boolean}
 */
export function isBase64Image(str) {
    return typeof str === 'string' && str.startsWith('data:image/');
}

/**
 * Check if a string is a Supabase Storage URL
 * @param {string} str
 * @returns {boolean}
 */
export function isStorageUrl(str) {
    return typeof str === 'string' && str.includes('supabase.co/storage/');
}
