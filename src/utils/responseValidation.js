const SPEC_COMPLETE_MARKER = '[SPEC_COMPLETE]';

export const extractFinalSpec = (text) => {
    if (!text || typeof text !== 'string') {
        return null;
    }

    const markerIndex = text.indexOf(SPEC_COMPLETE_MARKER);
    if (markerIndex === -1) {
        return null;
    }

    const content = text
        .slice(markerIndex + SPEC_COMPLETE_MARKER.length)
        .trim();
    const titleMatch = content.match(/^#\s+\S.*$/m);

    if (!titleMatch) {
        return null;
    }

    return content.slice(titleMatch.index).trim();
};

// Validation des réponses API - détecte les réponses incohérentes/corrompues
export const isValidResponse = (text, task = 'summary') => {
    if (task === 'interview') {
        return Boolean(
            text &&
            typeof text === 'object' &&
            typeof text.assistantMessage === 'string' &&
            text.assistantMessage.trim().length > 0 &&
            text.updates &&
            typeof text.updates === 'object' &&
            !Array.isArray(text.updates)
        );
    }

    if (task === 'spec') {
        return Boolean(
            text &&
            typeof text === 'object' &&
            typeof text.markdown === 'string' &&
            text.markdown.trim().length > 0
        );
    }

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
        return false;
    }

    if (text.includes(SPEC_COMPLETE_MARKER)) {
        return extractFinalSpec(text) !== null;
    }

    // Mots français courants qui devraient apparaître dans une réponse normale
    const frenchWords = ['le', 'la', 'de', 'et', 'tu', 'je', 'pour', 'que', 'est', 'un', 'une', 'en', 'ce', 'il', 'qui', 'ne', 'sur', 'se', 'pas', 'plus', 'par', 'son', 'avec', 'tout', 'faire', 'comme', 'ou', 'si', 'leur', 'y', 'mais', 'nous', 'cette', 'ont', 'bien', 'où', 'ces', 'sans', 'elle', 'peut', 'été', 'aussi', 'aux', 'être', 'fait', 'sont', 'quand', 'ton', 'ta', 'tes'];

    const originalWords = text.split(/\s+/);
    const lowerWords = text.toLowerCase().split(/\s+/);

    // Compte les mots français courants
    const frenchWordCount = lowerWords.filter(w => frenchWords.includes(w)).length;
    const frenchRatio = frenchWordCount / Math.max(lowerWords.length, 1);

    // Une réponse française normale devrait avoir au moins 8% de mots courants
    if (frenchRatio < 0.08 && lowerWords.length > 15) {
        return false;
    }

    // Détecte les mots "garbage" (très longs sans accents français, ou collés bizarrement)
    // Utilise les mots originaux pour détecter le camelCase
    const suspiciousWords = originalWords.filter(w =>
        w.length > 18 || // Mots anormalement longs
        (w.length > 12 && /[A-Z]/.test(w.slice(1))) || // camelCase au milieu
        /[а-яА-Я]/.test(w) // Caractères cyrilliques
    );

    if (suspiciousWords.length > 2) {
        return false;
    }

    return true;
};
