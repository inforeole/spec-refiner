/**
 * Service API pour le chat d'interview.
 *
 * Passe par l'Edge Function proxy `openrouter` (qui détient la clé côté serveur
 * et impose le modèle + le plafond de tokens). Aucune clé API n'est présente
 * dans le bundle front.
 */

import { API_CONFIG } from '../config/constants';
import { functionUrl, functionHeaders } from '../lib/apiClient';
import { isValidResponse } from '../utils/responseValidation';

/**
 * Appelle le proxy OpenRouter avec les messages fournis
 * @param {Object} options
 * @param {Array} options.messages - Messages de la conversation (incluant le system prompt)
 * @param {AbortSignal} [options.signal] - Signal pour annuler la requête
 * @returns {Promise<string>} Contenu de la réponse
 * @throws {Error} Si l'utilisateur n'est pas authentifié ou si l'appel échoue
 */
export async function callOpenRouterAPI({ messages, signal }) {
    const response = await fetch(functionUrl('openrouter'), {
        method: 'POST',
        headers: functionHeaders(),
        body: JSON.stringify({
            messages,
            maxTokens: API_CONFIG.MAX_TOKENS,
        }),
        signal
    });

    if (!response.ok) {
        let errorMessage = `Erreur API (${response.status})`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorMessage;
        } catch {
            // Réponse non-JSON, garder le message par défaut
        }
        throw new Error(errorMessage);
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error('Réponse API invalide (non-JSON)');
    }

    if (!data.choices?.[0]?.message?.content) {
        const errorMsg = data.error?.message || 'Réponse API inattendue';
        throw new Error(errorMsg);
    }

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
