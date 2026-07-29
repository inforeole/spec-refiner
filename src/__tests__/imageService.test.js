import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPublicUrlMock, uploadMock } = vi.hoisted(() => ({
    getPublicUrlMock: vi.fn(),
    uploadMock: vi.fn()
}));

vi.mock('../lib/supabase', () => ({
    isSupabaseConfigured: () => true,
    supabase: {
        storage: {
            from: () => ({
                getPublicUrl: getPublicUrlMock,
                upload: uploadMock
            })
        }
    }
}));

import { uploadImage } from '../services/imageService';

describe('imageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        uploadMock.mockImplementation(async path => ({
            data: { path },
            error: null
        }));
        getPublicUrlMock.mockImplementation(path => ({
            data: { publicUrl: `https://storage.example.com/${path}` }
        }));
    });

    it('utilise une clé Storage distincte pour deux images portant le même nom', async () => {
        const image = 'data:image/png;base64,QQ==';

        await uploadImage(image, 'capture.png');
        await uploadImage(image, 'capture.png');

        const firstPath = uploadMock.mock.calls[0][0];
        const secondPath = uploadMock.mock.calls[1][0];

        expect(firstPath).not.toBe(secondPath);
        expect(firstPath).toMatch(/\.png$/);
        expect(secondPath).toMatch(/\.png$/);
    });

    it('neutralise les séparateurs de chemin du nom original', async () => {
        await uploadImage('data:image/png;base64,QQ==', '../dossier/capture.png');

        const uploadedPath = uploadMock.mock.calls[0][0];

        expect(uploadedPath).not.toContain('/');
        expect(uploadedPath).not.toContain('..');
        expect(uploadedPath).toMatch(/capture\.png$/);
    });
});
