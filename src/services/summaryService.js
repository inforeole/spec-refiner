import { API_CONFIG } from '../config/constants';

const SUMMARY_PROMPT = `Tu es un assistant qui génère des résumés très courts de documents.
Analyse le contenu ci-dessous et génère un résumé en français de 10 mots maximum.
Le résumé doit décrire le TYPE et le SUJET du document.
Exemples: "Facture de service électrique", "Devis travaux plomberie", "Notes de réunion projet web"
Réponds UNIQUEMENT avec le résumé, sans ponctuation finale, sans guillemets.`;

/**
 * Generate a short summary of file content using Claude API
 * @param {string} fileContent - The extracted text content from the file
 * @param {string} fileName - The original filename
 * @returns {Promise<string>} - A short summary (~10 words)
 */
export async function generateFileSummary(fileContent, fileName) {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('API key missing');
    }

    // Truncate content to reduce token usage
    const truncatedContent = fileContent.substring(0, 2000);

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
            max_tokens: 50,
            messages: [
                { role: 'system', content: SUMMARY_PROMPT },
                {
                    role: 'user',
                    content: `Fichier: ${fileName}\n\nContenu:\n${truncatedContent}`
                }
            ]
        })
    });

    if (!response.ok) {
        let errorMessage = `Erreur génération résumé (${response.status})`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.error?.message || errorMessage;
        } catch {
            // Réponse non-JSON
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

    return data.choices[0].message.content.trim();
}
