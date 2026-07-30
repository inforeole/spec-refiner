import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    checkIsAdminMock,
    createUserMock,
    deleteImageMock,
    deleteUserMock,
    listUsersMock,
    resetUserProjectMock
} = vi.hoisted(() => ({
    checkIsAdminMock: vi.fn(),
    createUserMock: vi.fn(),
    deleteImageMock: vi.fn(),
    deleteUserMock: vi.fn(),
    listUsersMock: vi.fn(),
    resetUserProjectMock: vi.fn()
}));

vi.mock('../services/userService', () => ({
    checkIsAdmin: checkIsAdminMock,
    createUser: createUserMock,
    deleteUser: deleteUserMock,
    listUsers: listUsersMock,
    resetUserProject: resetUserProjectMock
}));

vi.mock('../services/imageService', () => ({
    deleteImage: deleteImageMock,
    isStorageUrl: url => url.includes('supabase.co/storage/')
}));

import AdminPage from '../components/AdminPage';

describe('AdminPage project reset', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        checkIsAdminMock.mockResolvedValue(true);
        listUsersMock.mockResolvedValue({
            users: [{
                id: 'user-2',
                email: 'client@example.com',
                created_at: '2026-07-30T10:00:00Z',
                is_admin: false
            }],
            error: null
        });
        resetUserProjectMock.mockResolvedValue({ messages: [], error: null });
    });

    it('requires the exact email before resetting a project', async () => {
        render(<AdminPage />);

        fireEvent.click(await screen.findByRole('button', {
            name: 'Réinitialiser le projet de client@example.com'
        }));

        expect(screen.getByRole('dialog').textContent).toContain('client@example.com');
        expect(screen.getByRole('button', {
            name: 'Réinitialiser définitivement'
        }).disabled).toBe(true);

        fireEvent.change(screen.getByLabelText('Confirmer avec l’adresse email'), {
            target: { value: 'client@example.com' }
        });

        expect(screen.getByRole('button', {
            name: 'Réinitialiser définitivement'
        }).disabled).toBe(false);
    });

    it('keeps a visible warning when an image cleanup fails', async () => {
        resetUserProjectMock.mockResolvedValue({
            messages: [{
                role: 'user',
                apiContent: [{
                    type: 'image_url',
                    image_url: {
                        url: 'https://project.supabase.co/storage/v1/object/public/specrefiner_images/a.png'
                    }
                }]
            }],
            error: null
        });
        deleteImageMock.mockResolvedValue({
            success: false,
            error: 'suppression impossible'
        });
        render(<AdminPage />);

        fireEvent.click(await screen.findByRole('button', {
            name: 'Réinitialiser le projet de client@example.com'
        }));
        fireEvent.change(screen.getByLabelText('Confirmer avec l’adresse email'), {
            target: { value: 'client@example.com' }
        });
        fireEvent.click(screen.getByRole('button', {
            name: 'Réinitialiser définitivement'
        }));

        await waitFor(() => {
            expect(screen.getByRole('status').textContent).toContain(
                'Projet réinitialisé, mais certaines images n’ont pas pu être supprimées'
            );
        });
    });
});
