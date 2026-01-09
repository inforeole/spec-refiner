import { describe, it, expect } from 'vitest';
import { isValidResponse } from '../utils/responseValidation';

describe('isValidResponse', () => {
    describe('rejette les réponses invalides', () => {
        it('rejette null', () => {
            expect(isValidResponse(null)).toBe(false);
        });

        it('rejette undefined', () => {
            expect(isValidResponse(undefined)).toBe(false);
        });

        it('rejette une chaîne vide', () => {
            expect(isValidResponse('')).toBe(false);
        });

        it('rejette une chaîne trop courte (< 10 caractères)', () => {
            expect(isValidResponse('Bonjour')).toBe(false);
        });

        it('rejette un nombre', () => {
            expect(isValidResponse(123)).toBe(false);
        });

        it('rejette un objet', () => {
            expect(isValidResponse({ text: 'hello' })).toBe(false);
        });
    });

    describe('accepte les réponses françaises valides', () => {
        it('accepte une phrase française simple', () => {
            expect(isValidResponse('Bonjour, je suis là pour vous aider avec votre projet.')).toBe(true);
        });

        it('accepte une réponse plus longue avec du contenu français', () => {
            const response = `Je comprends bien ton besoin. Tu veux créer une application
            de gestion de tâches pour ton équipe. C'est un projet intéressant !
            Peux-tu me dire combien de personnes utiliseront cette application ?`;
            expect(isValidResponse(response)).toBe(true);
        });

        it('accepte une réponse avec markdown', () => {
            const response = `## Contexte et objectifs

            Le projet vise à créer une application web de gestion des tâches.

            **Points clés :**
            - Centraliser la gestion
            - Améliorer le suivi`;
            expect(isValidResponse(response)).toBe(true);
        });
    });

    describe('rejette les réponses corrompues/garbage', () => {
        it('rejette du texte sans mots français (ratio < 8%)', () => {
            const garbage = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua';
            expect(isValidResponse(garbage)).toBe(false);
        });

        it('rejette du texte avec caractères cyrilliques', () => {
            const cyrillic = 'Это текст на русском языке который не должен быть accepté';
            expect(isValidResponse(cyrillic)).toBe(false);
        });

        it('rejette du texte avec des mots anormalement longs', () => {
            const longWords = 'Voici un texte avec superlongwordthatmakesnosense et encore un autremotincroyablementlong et un troisièmemottreslong';
            expect(isValidResponse(longWords)).toBe(false);
        });

        it('rejette du texte avec du camelCase suspect', () => {
            const camelCase = 'Ce texte contient thisIsWeirdCamelCase et aussi anotherWeirdOne plus encoreUnAutre';
            expect(isValidResponse(camelCase)).toBe(false);
        });
    });

    describe('cas limites', () => {
        it('accepte une réponse courte mais valide (> 10 chars)', () => {
            expect(isValidResponse('Je comprends !')).toBe(true);
        });

        it('accepte du texte avec quelques mots anglais courants', () => {
            const mixed = 'Je pense que le dashboard est une bonne idée pour ton projet.';
            expect(isValidResponse(mixed)).toBe(true);
        });

        it('gère les espaces multiples', () => {
            expect(isValidResponse('Bonjour    je   suis   là   pour   toi.')).toBe(true);
        });
    });
});
