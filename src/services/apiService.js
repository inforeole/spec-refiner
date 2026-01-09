/**
 * Service API pour les appels à OpenRouter
 */

import { API_CONFIG } from '../config/constants';
import { isValidResponse } from '../utils/responseValidation';

/**
 * Appelle l'API OpenRouter avec les messages fournis
 * @param {Object} options
 * @param {Array} options.messages - Messages de la conversation (incluant le system prompt)
 * @param {AbortSignal} [options.signal] - Signal pour annuler la requête
 * @returns {Promise<string>} Contenu de la réponse
 * @throws {Error} Si la clé API est manquante ou si l'appel échoue
 */
export async function callOpenRouterAPI({ messages, signal }) {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('Clé API manquante. Ajoutez VITE_OPENROUTER_API_KEY dans le fichier .env');
    }

    const response = await fetch(API_CONFIG.OPENROUTER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Spec Refiner',
        },
        body: JSON.stringify({
            model: API_CONFIG.MODEL,
            max_tokens: API_CONFIG.MAX_TOKENS,
            messages
        }),
        signal
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Appelle l'API avec retry automatique si la réponse est incohérente
 * @param {Object} options
 * @param {Array} options.messages - Messages de la conversation
 * @param {AbortSignal} [options.signal] - Signal pour annuler la requête
 * @param {number} [options.maxRetries] - Nombre max de tentatives
 * @returns {Promise<{response: string, isValid: boolean}>}
 */
export async function callAPIWithRetry({ messages, signal, maxRetries = API_CONFIG.MAX_RETRIES }) {
    let response = await callOpenRouterAPI({ messages, signal });
    let retryCount = 0;

    while (!isValidResponse(response) && retryCount < maxRetries) {
        console.warn(`Réponse incohérente détectée (tentative ${retryCount + 1}/${maxRetries}), nouvelle tentative...`);
        retryCount++;
        response = await callOpenRouterAPI({ messages, signal });
    }

    return { response, isValid: isValidResponse(response) };
}
