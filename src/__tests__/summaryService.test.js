import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/apiClient', () => ({
    functionUrl: (name) => `https://proxy.test/functions/v1/${name}`,
    functionHeaders: () => ({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer anon-test',
        'apikey': 'anon-test',
        'X-Session-Token': 'session-test'
    })
}));

import { generateFileSummary } from '../services/summaryService';

describe('generateFileSummary', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: '  Notes de réunion projet web  ' } }]
            })
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('demande explicitement la route de résumé au proxy', async () => {
        const result = await generateFileSummary('Contenu du document', 'notes.txt');

        const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(requestBody.task).toBe('summary');
        expect(requestBody.maxTokens).toBe(50);
        expect(requestBody.messages).toHaveLength(2);
        expect(result).toBe('Notes de réunion projet web');
    });
});
