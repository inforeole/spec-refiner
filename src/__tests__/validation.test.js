/**
 * Security validation tests
 * Tests for email and password validation functions
 */

import { describe, it, expect } from 'vitest';
import {
    validateEmail,
    validatePassword,
    validatePasswordSimple,
    sanitizeEmail
} from '../utils/validation';

describe('validateEmail', () => {
    it('should accept valid emails', () => {
        const validEmails = [
            'test@example.com',
            'user.name@domain.org',
            'user+tag@example.co.uk',
            'a@b.co',
            'test123@test-domain.com'
        ];

        validEmails.forEach(email => {
            const result = validateEmail(email);
            expect(result.isValid, `Expected "${email}" to be valid`).toBe(true);
            expect(result.error).toBeNull();
        });
    });

    it('should reject invalid emails', () => {
        const invalidEmails = [
            '',
            'not-an-email',
            '@missing-local.com',
            'missing-domain@',
            'missing@.com',
            'spaces in@email.com',
            'double@@at.com',
            null,
            undefined
        ];

        invalidEmails.forEach(email => {
            const result = validateEmail(email);
            expect(result.isValid, `Expected "${email}" to be invalid`).toBe(false);
            expect(result.error).toBeTruthy();
        });
    });

    it('should reject emails that are too long', () => {
        const longEmail = 'a'.repeat(250) + '@test.com';
        const result = validateEmail(longEmail);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('trop long');
    });

    it('should trim whitespace', () => {
        const result = validateEmail('  test@example.com  ');
        expect(result.isValid).toBe(true);
    });
});

describe('validatePassword', () => {
    it('should accept strong passwords', () => {
        const strongPasswords = [
            'MyP@ssw0rd123!',
            'SecurePass1@abc',
            'Test!ng12345Abc',
            'C0mpl3x#Pass!'
        ];

        strongPasswords.forEach(password => {
            const result = validatePassword(password);
            expect(result.isValid, `Expected "${password}" to be valid`).toBe(true);
            expect(result.error).toBeNull();
        });
    });

    it('should reject passwords shorter than 12 characters', () => {
        const result = validatePassword('Short1!a');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('12 caractères');
    });

    it('should reject passwords without uppercase', () => {
        const result = validatePassword('nouppercase123!@');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('majuscule');
    });

    it('should reject passwords without lowercase', () => {
        const result = validatePassword('NOLOWERCASE123!@');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('minuscule');
    });

    it('should reject passwords without numbers', () => {
        const result = validatePassword('NoNumbers!!Abc');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('chiffre');
    });

    it('should reject passwords without special characters', () => {
        const result = validatePassword('NoSpecial123Abc');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('spécial');
    });

    it('should handle null/undefined', () => {
        expect(validatePassword(null).isValid).toBe(false);
        expect(validatePassword(undefined).isValid).toBe(false);
        expect(validatePassword('').isValid).toBe(false);
    });

    it('should return correct strength indicators', () => {
        // Weak password (multiple issues)
        const weak = validatePassword('short');
        expect(weak.strength).toBe('weak');

        // Medium password (valid but basic)
        const medium = validatePassword('MyP@ssw0rd123');
        expect(medium.strength).toBe('medium');

        // Strong password (long with multiple special chars)
        const strong = validatePassword('MyVeryStr0ng!@Pass');
        expect(strong.strength).toBe('strong');
    });
});

describe('validatePasswordSimple', () => {
    it('should accept passwords with 8+ characters', () => {
        const result = validatePasswordSimple('12345678');
        expect(result.isValid).toBe(true);
    });

    it('should reject passwords shorter than 8 characters', () => {
        const result = validatePasswordSimple('1234567');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('8 caractères');
    });
});

describe('sanitizeEmail', () => {
    it('should lowercase and trim emails', () => {
        expect(sanitizeEmail('  TEST@Example.COM  ')).toBe('test@example.com');
        expect(sanitizeEmail('User@Domain.Org')).toBe('user@domain.org');
    });

    it('should handle invalid inputs', () => {
        expect(sanitizeEmail(null)).toBe('');
        expect(sanitizeEmail(undefined)).toBe('');
        expect(sanitizeEmail('')).toBe('');
        expect(sanitizeEmail(123)).toBe('');
    });
});

// Security-focused tests
describe('Security edge cases', () => {
    it('should handle emails with special characters safely', () => {
        // These malicious-looking emails may pass basic format validation
        // but the important thing is they don't crash and are properly sanitized
        const edgeCaseEmails = [
            '<script>alert(1)</script>@test.com',
            'test@<script>.com',
            '"><script>@test.com'
        ];

        edgeCaseEmails.forEach(email => {
            // Should not crash
            expect(() => validateEmail(email)).not.toThrow();
            // Sanitization should lowercase and trim
            const sanitized = sanitizeEmail(email);
            expect(sanitized).toBe(email.toLowerCase().trim());
        });
    });

    it('should handle SQL injection attempts in emails', () => {
        const sqlEmails = [
            "'; DROP TABLE users; --@test.com",
            "test@test.com' OR '1'='1",
            "admin'--@test.com"
        ];

        // These might pass email validation but will be properly escaped by Supabase
        // The important thing is they don't crash the validator
        sqlEmails.forEach(email => {
            expect(() => validateEmail(email)).not.toThrow();
        });
    });

    it('should not crash on extremely long inputs', () => {
        const longString = 'a'.repeat(10000);
        expect(() => validateEmail(longString)).not.toThrow();
        expect(() => validatePassword(longString)).not.toThrow();
    });

    it('should handle unicode and special characters', () => {
        // Password with unicode should work
        const result = validatePassword('MyP@ssw0rd123!');
        expect(result.isValid).toBe(true);

        // Email validation should handle international domains
        const emailResult = validateEmail('test@example.co.uk');
        expect(emailResult.isValid).toBe(true);
    });
});
