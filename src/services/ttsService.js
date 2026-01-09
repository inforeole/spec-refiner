/**
 * Service TTS pour la synthèse vocale via Inworld AI
 */

import { TTS_CONFIG } from '../config/constants';

/**
 * Extrait le résumé audio du message (balise [AUDIO]...[/AUDIO])
 * Si pas de balise, retourne null
 * @param {string} text - Texte du message
 * @returns {string|null} Résumé audio ou null
 */
function extractAudioSummary(text) {
    const match = text.match(/\[AUDIO\]([\s\S]*?)\[\/AUDIO\]/i);
    if (match && match[1]) {
        return match[1].trim();
    }
    return null;
}

/**
 * Nettoie le texte pour la synthèse vocale
 * @param {string} text - Texte avec potentiel markdown
 * @returns {string} Texte nettoyé
 */
function cleanTextForTTS(text) {
    return text
        // Remove markdown links [text](url) -> text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove bold/italic
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove code blocks
        .replace(/```[^`]*```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        // Remove headers
        .replace(/^#+\s*/gm, '')
        // Remove bullet points
        .replace(/^[-*]\s*/gm, '')
        // Remove emojis (basic)
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        // Clean up extra whitespace
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Prépare le texte pour la synthèse vocale
 * Extrait le résumé [AUDIO] si présent, sinon utilise la première phrase
 * @param {string} text - Texte complet du message
 * @returns {string} Texte à synthétiser
 */
function prepareTextForTTS(text) {
    // Essaie d'extraire le résumé audio
    const audioSummary = extractAudioSummary(text);
    if (audioSummary) {
        return cleanTextForTTS(audioSummary);
    }

    // Fallback: prendre la première phrase (max 200 caractères)
    const cleaned = cleanTextForTTS(text);
    const firstSentence = cleaned.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length > 10) {
        return firstSentence.substring(0, 200);
    }

    return cleaned.substring(0, 200);
}

/**
 * Synthétise du texte en audio via l'API Inworld
 * @param {string} text - Texte à convertir en audio
 * @param {AbortSignal} [signal] - Signal pour annuler la requête
 * @returns {Promise<{audio: Blob|null, error: string|null}>}
 */
export async function synthesizeSpeech(text, signal) {
    const apiKey = import.meta.env.VITE_INWORLD_API_KEY;
    if (!apiKey) {
        return { audio: null, error: 'Clé API Inworld manquante' };
    }

    const ttsText = prepareTextForTTS(text);
    if (!ttsText) {
        return { audio: null, error: 'Texte vide après préparation' };
    }

    try {
        const response = await fetch(TTS_CONFIG.ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${apiKey}`
            },
            body: JSON.stringify({
                text: ttsText,
                voiceId: TTS_CONFIG.VOICE_ID,
                modelId: TTS_CONFIG.MODEL,
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: TTS_CONFIG.SPEAKING_RATE
                },
                temperature: TTS_CONFIG.TEMPERATURE
            }),
            signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('TTS API error:', response.status, errorText);
            return {
                audio: null,
                error: `Erreur TTS: ${response.status}`
            };
        }

        const data = await response.json();

        if (!data.audioContent) {
            console.error('TTS API: no audioContent in response');
            return { audio: null, error: 'Pas de contenu audio dans la réponse' };
        }

        // Decode base64 audio content
        const binaryString = atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });

        return { audio: audioBlob, error: null };
    } catch (error) {
        if (error.name === 'AbortError') {
            return { audio: null, error: null };
        }
        console.error('TTS fetch error:', error);
        return { audio: null, error: error.message };
    }
}
