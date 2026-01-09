// Configuration centralisée de l'application

// API
export const API_CONFIG = {
    MAX_TOKENS: 8192,
    MAX_RETRIES: 2,
    OPENROUTER_URL: 'https://openrouter.ai/api/v1/chat/completions',
    MODEL: 'anthropic/claude-sonnet-4'
};

// Timeouts (en ms)
export const TIMEOUTS = {
    PDF_PROCESSING: 60000,      // PDF peut être lent
    FILE_PROCESSING: 30000,     // Autres fichiers
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

// Text-to-Speech (Inworld AI)
export const TTS_CONFIG = {
    ENDPOINT: 'https://api.inworld.ai/tts/v1/voice',
    MODEL: 'inworld-tts-1-max',
    VOICE_ID: 'default-o-lizv8yves-5uhgzcrjog__vanessa',
    SPEAKING_RATE: 1,
    TEMPERATURE: 1.1
};
