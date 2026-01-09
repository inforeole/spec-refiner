import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../hooks/useAuth';

describe('useAuth', () => {
    const mockPassword = 'test-password';

    beforeEach(() => {
        // Mock import.meta.env
        vi.stubEnv('VITE_APP_PASSWORD', mockPassword);
        // Clear sessionStorage
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('état initial', () => {
        it('isAuthenticated est false par défaut', () => {
            const { result } = renderHook(() => useAuth());
            expect(result.current.isAuthenticated).toBe(false);
        });

        it('passwordInput est vide par défaut', () => {
            const { result } = renderHook(() => useAuth());
            expect(result.current.passwordInput).toBe('');
        });

        it('authError est false par défaut', () => {
            const { result } = renderHook(() => useAuth());
            expect(result.current.authError).toBe(false);
        });

        it('restaure l\'auth depuis sessionStorage', () => {
            sessionStorage.setItem('spec-refiner-auth', 'true');
            const { result } = renderHook(() => useAuth());
            expect(result.current.isAuthenticated).toBe(true);
        });
    });

    describe('handleLogin', () => {
        it('authentifie avec le bon mot de passe', () => {
            const { result } = renderHook(() => useAuth());
            const mockEvent = { preventDefault: vi.fn() };

            act(() => {
                result.current.setPasswordInput(mockPassword);
            });

            act(() => {
                result.current.handleLogin(mockEvent);
            });

            expect(result.current.isAuthenticated).toBe(true);
            expect(result.current.authError).toBe(false);
            expect(sessionStorage.getItem('spec-refiner-auth')).toBe('true');
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });

        it('refuse un mot de passe incorrect', () => {
            const { result } = renderHook(() => useAuth());
            const mockEvent = { preventDefault: vi.fn() };

            act(() => {
                result.current.setPasswordInput('wrong-password');
            });

            act(() => {
                result.current.handleLogin(mockEvent);
            });

            expect(result.current.isAuthenticated).toBe(false);
            expect(result.current.authError).toBe(true);
        });

        it('gère les mots de passe avec guillemets', () => {
            vi.stubEnv('VITE_APP_PASSWORD', '"quoted-password"');
            const { result } = renderHook(() => useAuth());
            const mockEvent = { preventDefault: vi.fn() };

            act(() => {
                result.current.setPasswordInput('quoted-password');
            });

            act(() => {
                result.current.handleLogin(mockEvent);
            });

            expect(result.current.isAuthenticated).toBe(true);
        });

        it('gère les mots de passe avec espaces', () => {
            vi.stubEnv('VITE_APP_PASSWORD', '  spaced-password  ');
            const { result } = renderHook(() => useAuth());
            const mockEvent = { preventDefault: vi.fn() };

            act(() => {
                result.current.setPasswordInput('spaced-password');
            });

            act(() => {
                result.current.handleLogin(mockEvent);
            });

            expect(result.current.isAuthenticated).toBe(true);
        });
    });

    describe('setPasswordInput', () => {
        it('met à jour passwordInput', () => {
            const { result } = renderHook(() => useAuth());

            act(() => {
                result.current.setPasswordInput('new-value');
            });

            expect(result.current.passwordInput).toBe('new-value');
        });
    });
});
