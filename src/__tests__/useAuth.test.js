import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../hooks/useAuth';
import * as userService from '../services/userService';

// Le login réel passe par un RPC serveur (login_user_secure) qui émet un token
// de session. On mocke le service pour tester la logique du hook isolément.
vi.mock('../services/userService', () => ({
    loginUser: vi.fn(),
    logoutSession: vi.fn(),
}));

const AUTH_KEY = 'spec-refiner-auth';

describe('useAuth', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    describe('état initial', () => {
        it('isAuthenticated est false et user null par défaut', () => {
            const { result } = renderHook(() => useAuth());
            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.user).toBe(null);
        });

        it('inputs vides et authError null par défaut', () => {
            const { result } = renderHook(() => useAuth());
            expect(result.current.emailInput).toBe('');
            expect(result.current.passwordInput).toBe('');
            expect(result.current.authError).toBe(null);
        });

        it('restaure l\'utilisateur depuis sessionStorage (JSON id+email)', () => {
            sessionStorage.setItem(AUTH_KEY, JSON.stringify({ id: 'u1', email: 'a@b.c', sessionToken: 'tok' }));
            const { result } = renderHook(() => useAuth());
            expect(result.current.isAuthenticated).toBe(true);
            expect(result.current.user.email).toBe('a@b.c');
        });

        it('ignore un sessionStorage corrompu', () => {
            sessionStorage.setItem(AUTH_KEY, 'not-json');
            const { result } = renderHook(() => useAuth());
            expect(result.current.isAuthenticated).toBe(false);
        });
    });

    describe('handleLogin', () => {
        it('connecte avec des identifiants valides et persiste la session (token serveur)', async () => {
            const mockUser = { id: 'u1', email: 'a@b.c', sessionToken: 'tok-123' };
            userService.loginUser.mockResolvedValue({ user: mockUser, error: null });

            const { result } = renderHook(() => useAuth());
            act(() => {
                result.current.setEmailInput('a@b.c');
                result.current.setPasswordInput('secret');
            });
            await act(async () => {
                await result.current.handleLogin({ preventDefault: vi.fn() });
            });

            expect(userService.loginUser).toHaveBeenCalledWith('a@b.c', 'secret');
            expect(result.current.isAuthenticated).toBe(true);
            expect(JSON.parse(sessionStorage.getItem(AUTH_KEY)).sessionToken).toBe('tok-123');
        });

        it('remonte l\'erreur avec des identifiants invalides', async () => {
            userService.loginUser.mockResolvedValue({ user: null, error: 'Email ou mot de passe incorrect' });

            const { result } = renderHook(() => useAuth());
            act(() => { result.current.setPasswordInput('wrong'); });
            await act(async () => {
                await result.current.handleLogin({ preventDefault: vi.fn() });
            });

            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.authError).toBe('Email ou mot de passe incorrect');
            expect(sessionStorage.getItem(AUTH_KEY)).toBe(null);
        });
    });

    describe('logout', () => {
        it('invalide le token de session côté serveur et nettoie l\'état', async () => {
            const mockUser = { id: 'u1', email: 'a@b.c', sessionToken: 'tok-123' };
            userService.loginUser.mockResolvedValue({ user: mockUser, error: null });

            const { result } = renderHook(() => useAuth());
            await act(async () => {
                await result.current.handleLogin({ preventDefault: vi.fn() });
            });
            act(() => { result.current.logout(); });

            expect(userService.logoutSession).toHaveBeenCalledWith('tok-123');
            expect(result.current.isAuthenticated).toBe(false);
            expect(sessionStorage.getItem(AUTH_KEY)).toBe(null);
        });
    });
});
