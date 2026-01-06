import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Paragraph, TextRun } from 'docx';
import {
    parseMarkdownToDocx,
    parseInlineFormatting,
    downloadAsWord
} from '../utils/wordExport.js';

// Mock file-saver
vi.mock('file-saver', () => ({
    saveAs: vi.fn()
}));

describe('Word Export', () => {
    describe('parseInlineFormatting', () => {
        it('should return plain text as single TextRun', () => {
            const result = parseInlineFormatting('Hello world');

            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(TextRun);
        });

        it('should parse bold text with **', () => {
            const result = parseInlineFormatting('Hello **bold** world');

            expect(result.length).toBeGreaterThan(1);
            // Verify we got multiple TextRun instances
            expect(result.every(run => run instanceof TextRun)).toBe(true);
        });

        it('should parse italic text with *', () => {
            const result = parseInlineFormatting('Hello *italic* world');

            expect(result.length).toBeGreaterThan(1);
            // Verify we got multiple TextRun instances
            expect(result.every(run => run instanceof TextRun)).toBe(true);
        });

        it('should parse inline code with backticks', () => {
            const result = parseInlineFormatting('Use `code` here');

            expect(result.length).toBeGreaterThan(1);
            // Verify we got multiple TextRun instances
            expect(result.every(run => run instanceof TextRun)).toBe(true);
        });

        it('should handle empty string', () => {
            const result = parseInlineFormatting('');

            // Empty string returns empty array (no text runs needed)
            expect(result).toHaveLength(0);
        });

        it('should handle multiple bold sections', () => {
            const result = parseInlineFormatting('**first** and **second**');

            expect(result.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('parseMarkdownToDocx', () => {
        it('should parse H1 headers', () => {
            const result = parseMarkdownToDocx('# Main Title');

            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toBeInstanceOf(Paragraph);
        });

        it('should parse H2 headers', () => {
            const result = parseMarkdownToDocx('## Section Title');

            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toBeInstanceOf(Paragraph);
        });

        it('should parse H3 headers', () => {
            const result = parseMarkdownToDocx('### Subsection');

            expect(result.length).toBeGreaterThan(0);
        });

        it('should parse H4 headers', () => {
            const result = parseMarkdownToDocx('#### Small Header');

            expect(result.length).toBeGreaterThan(0);
        });

        it('should parse bullet lists with -', () => {
            const markdown = '- Item 1\n- Item 2\n- Item 3';
            const result = parseMarkdownToDocx(markdown);

            expect(result.length).toBe(3);
        });

        it('should parse bullet lists with *', () => {
            const markdown = '* Item A\n* Item B';
            const result = parseMarkdownToDocx(markdown);

            expect(result.length).toBe(2);
        });

        it('should parse numbered lists', () => {
            const markdown = '1. First\n2. Second\n3. Third';
            const result = parseMarkdownToDocx(markdown);

            expect(result.length).toBe(3);
        });

        it('should parse code blocks', () => {
            const markdown = '```javascript\nconst x = 1;\n```';
            const result = parseMarkdownToDocx(markdown);

            expect(result.length).toBeGreaterThan(0);
        });

        it('should handle empty lines', () => {
            const markdown = 'Line 1\n\nLine 2';
            const result = parseMarkdownToDocx(markdown);

            // Should have 3 paragraphs: line1, empty, line2
            expect(result.length).toBe(3);
        });

        it('should handle empty markdown', () => {
            const result = parseMarkdownToDocx('');

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should parse regular paragraphs', () => {
            const markdown = 'This is a regular paragraph.';
            const result = parseMarkdownToDocx(markdown);

            expect(result.length).toBe(1);
            expect(result[0]).toBeInstanceOf(Paragraph);
        });

        it('should handle mixed content', () => {
            const markdown = `# Title

This is a paragraph.

## Section

- List item 1
- List item 2

\`\`\`
code block
\`\`\`

Another paragraph.`;

            const result = parseMarkdownToDocx(markdown);

            expect(result.length).toBeGreaterThan(5);
        });

        it('should preserve inline formatting in paragraphs', () => {
            const markdown = 'This has **bold** and *italic* text.';
            const result = parseMarkdownToDocx(markdown);

            expect(result.length).toBe(1);
            expect(result[0]).toBeInstanceOf(Paragraph);
        });

        it('should handle French characters', () => {
            const markdown = '# Spécifications\n\nCeci est un paragraphe avec des accents: é è à ù ç';
            const result = parseMarkdownToDocx(markdown);

            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('downloadAsWord', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should generate a document with default filename', async () => {
            const { saveAs } = await import('file-saver');

            await downloadAsWord('# Test Content');

            expect(saveAs).toHaveBeenCalledTimes(1);
            expect(saveAs).toHaveBeenCalledWith(
                expect.any(Blob),
                'specifications.docx'
            );
        });

        it('should use custom filename when provided', async () => {
            const { saveAs } = await import('file-saver');

            await downloadAsWord('# Test', 'custom-name.docx');

            expect(saveAs).toHaveBeenCalledWith(
                expect.any(Blob),
                'custom-name.docx'
            );
        });

        it('should generate valid blob', async () => {
            const { saveAs } = await import('file-saver');

            await downloadAsWord('# Test Content\n\nParagraph here.');

            const blob = saveAs.mock.calls[0][0];
            expect(blob).toBeInstanceOf(Blob);
            expect(blob.size).toBeGreaterThan(0);
        });

        it('should handle complex markdown', async () => {
            const { saveAs } = await import('file-saver');

            const complexMarkdown = `# Document Principal

## Introduction

Ceci est une introduction avec du **texte en gras** et du *texte en italique*.

## Liste des fonctionnalités

- Fonctionnalité 1
- Fonctionnalité 2
- Fonctionnalité 3

## Code exemple

\`\`\`javascript
function hello() {
    console.log('Hello');
}
\`\`\`

## Conclusion

Merci d'avoir lu ce document.`;

            await downloadAsWord(complexMarkdown, 'complex-doc.docx');

            expect(saveAs).toHaveBeenCalledTimes(1);
            const blob = saveAs.mock.calls[0][0];
            expect(blob.size).toBeGreaterThan(1000);
        });

        it('should handle empty content', async () => {
            const { saveAs } = await import('file-saver');

            await downloadAsWord('');

            expect(saveAs).toHaveBeenCalledTimes(1);
        });
    });
});
