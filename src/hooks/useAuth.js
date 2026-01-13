import { useState, useEffect, useCallback } from 'react';
import { loginUser } from '../services/userService';

const AUTH_STORAGE_KEY = 'spec-refiner-auth';

/**
 * Hook pour gérer l'authentification utilisateur
 * @returns {Object} { user, isAuthenticated, emailInput, setEmailInput, passwordInput, setPasswordInput, authError, isLoading, handleLogin, logout }
 */
export function useAuth() {
    const [user, setUser] = useState(null);
    const [emailInput, setEmailInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Vérifier l'auth au montage
    useEffect(() => {
        const storedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY);
        if (storedAuth) {
            try {
                const userData = JSON.parse(storedAuth);
                if (userData?.id && userData?.email) {
                    setUser(userData);
                }
            } catch {
                sessionStorage.removeItem(AUTH_STORAGE_KEY);
            }
        }
    }, []);

    const handleLogin = useCallback(async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setAuthError(null);

        const { user: loggedInUser, error } = await loginUser(emailInput, passwordInput);

        if (loggedInUser) {
            setUser(loggedInUser);
            sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedInUser));
            setPasswordInput('');
        } else {
            setAuthError(error || 'Erreur de connexion');
        }

        setIsLoading(false);
    }, [emailInput, passwordInput]);

    const logout = useCallback(() => {
        setUser(null);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        setEmailInput('');
        setPasswordInput('');
        setAuthError(null);
    }, []);

    return {
        user,
        isAuthenticated: !!user,
        emailInput,
        setEmailInput,
        passwordInput,
        setPasswordInput,
        authError,
        isLoading,
        handleLogin,
        logout
    };
}
