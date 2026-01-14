/**
 * Validation utilities for security
 */

/**
 * Validate email format
 * @param {string} email
 * @returns {{isValid: boolean, error: string|null}}
 */
export function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { isValid: false, error: 'Email requis' };
    }

    const trimmed = email.trim();

    if (trimmed.length === 0) {
        return { isValid: false, error: 'Email requis' };
    }

    // RFC 5322 compliant email regex (simplified but robust)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
        return { isValid: false, error: 'Format email invalide' };
    }

    if (trimmed.length > 254) {
        return { isValid: false, error: 'Email trop long (max 254 caractères)' };
    }

    return { isValid: true, error: null };
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * @param {string} password
 * @returns {{isValid: boolean, error: string|null, strength: 'weak'|'medium'|'strong'}}
 */
export function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { isValid: false, error: 'Mot de passe requis', strength: 'weak' };
    }

    const errors = [];

    if (password.length < 12) {
        errors.push('au moins 12 caractères');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('une majuscule');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('une minuscule');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('un chiffre');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
        errors.push('un caractère spécial (!@#$%^&*...)');
    }

    if (errors.length > 0) {
        return {
            isValid: false,
            error: `Le mot de passe doit contenir ${errors.join(', ')}`,
            strength: errors.length > 2 ? 'weak' : 'medium'
        };
    }

    // Calculate strength
    let strength = 'medium';
    if (password.length >= 16 && /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?].*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
        strength = 'strong';
    }

    return { isValid: true, error: null, strength };
}

/**
 * Validate password (simple version for backward compatibility during transition)
 * Use this temporarily if you need gradual rollout
 * @param {string} password
 * @returns {{isValid: boolean, error: string|null}}
 */
export function validatePasswordSimple(password) {
    if (!password || typeof password !== 'string') {
        return { isValid: false, error: 'Mot de passe requis' };
    }

    if (password.length < 8) {
        return { isValid: false, error: 'Le mot de passe doit faire au moins 8 caractères' };
    }

    return { isValid: true, error: null };
}

/**
 * Sanitize email for storage
 * @param {string} email
 * @returns {string}
 */
export function sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
        return '';
    }
    return email.toLowerCase().trim();
}
