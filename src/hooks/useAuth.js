import { useState, useEffect, useCallback } from 'react';

const AUTH_STORAGE_KEY = 'spec-refiner-auth';

/**
 * Hook pour gérer l'authentification de l'application
 * @returns {Object} { isAuthenticated, passwordInput, setPasswordInput, authError, handleLogin }
 */
export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState(false);

    // Vérifier l'auth au montage
    useEffect(() => {
        const sessionAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
        if (sessionAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = useCallback((e) => {
        e.preventDefault();
        // Strip quotes and trim in case .env has quoted value
        const correctPassword = (import.meta.env.VITE_APP_PASSWORD || '')
            .replace(/^["']|["']$/g, '')
            .trim();
        if (passwordInput === correctPassword) {
            setIsAuthenticated(true);
            setAuthError(false);
            sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
        } else {
            setAuthError(true);
        }
    }, [passwordInput]);

    return {
        isAuthenticated,
        passwordInput,
        setPasswordInput,
        authError,
        handleLogin
    };
}
