// Configuration centralisée de l'application

// API
// Le modèle et l'URL OpenRouter sont désormais IMPOSÉS côté serveur (Edge
// Function `openrouter`). Aucune clé ni cible d'API tierce dans le bundle front.
export const API_CONFIG = {
    MAX_TOKENS: 8192,   // plafonné à nouveau côté serveur
    MAX_RETRIES: 2
};

// Timeouts (en ms)
export const TIMEOUTS = {
    PDF_PROCESSING: 60000,      // PDF peut être lent
    FILE_PROCESSING: 30000,     // Autres fichiers
    SUPABASE_RPC: 15000,        // Empêche un appel DB de bloquer l'interface
    SAVE_DEBOUNCE: 1000         // Délai avant sauvegarde auto
};

// Interview
export const INTERVIEW_CONFIG = {
    MIN_QUESTIONS_BEFORE_SPEC: 3  // Minimum d'échanges avant de proposer la génération
};

// Marqueurs de réponse
export const MARKERS = {
    SPEC_COMPLETE: '[SPEC_COMPLETE]'
};

// La config Text-to-Speech (endpoint, voix, modèle Inworld) est désormais
// imposée côté serveur dans l'Edge Function `inworld`. Le front n'envoie que le
// texte à synthétiser.
