import {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Packer,
    BorderStyle
} from 'docx';
import { saveAs } from 'file-saver';

/**
 * Parse markdown content and convert to docx paragraphs
 */
function parseMarkdownToDocx(markdown) {
    const lines = markdown.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBlockContent = [];
    let listItems = [];

    const flushList = () => {
        if (listItems.length > 0) {
            listItems.forEach(item => {
                elements.push(
                    new Paragraph({
                        children: [new TextRun({ text: `• ${item}` })],
                        indent: { left: 720 },
                        spacing: { after: 100 }
                    })
                );
            });
            listItems = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Code block handling
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                // End code block
                elements.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: codeBlockContent.join('\n'),
                                font: 'Courier New',
                                size: 20
                            })
                        ],
                        shading: { fill: 'F5F5F5' },
                        spacing: { after: 200 }
                    })
                );
                codeBlockContent = [];
                inCodeBlock = false;
            } else {
                flushList();
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent.push(line);
            continue;
        }

        // Empty line
        if (line.trim() === '') {
            flushList();
            elements.push(new Paragraph({ spacing: { after: 100 } }));
            continue;
        }

        // Headers
        if (line.startsWith('# ')) {
            flushList();
            elements.push(
                new Paragraph({
                    children: [new TextRun({ text: line.substring(2), bold: true, size: 36 })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 }
                })
            );
            continue;
        }

        if (line.startsWith('## ')) {
            flushList();
            elements.push(
                new Paragraph({
                    children: [new TextRun({ text: line.substring(3), bold: true, size: 32 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 150 }
                })
            );
            continue;
        }

        if (line.startsWith('### ')) {
            flushList();
            elements.push(
                new Paragraph({
                    children: [new TextRun({ text: line.substring(4), bold: true, size: 28 })],
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 200, after: 100 }
                })
            );
            continue;
        }

        if (line.startsWith('#### ')) {
            flushList();
            elements.push(
                new Paragraph({
                    children: [new TextRun({ text: line.substring(5), bold: true, size: 24 })],
                    heading: HeadingLevel.HEADING_4,
                    spacing: { before: 150, after: 100 }
                })
            );
            continue;
        }

        // List items
        if (line.match(/^[-*]\s/)) {
            listItems.push(line.substring(2).trim());
            continue;
        }

        if (line.match(/^\d+\.\s/)) {
            const text = line.replace(/^\d+\.\s/, '').trim();
            listItems.push(text);
            continue;
        }

        // Regular paragraph with inline formatting
        flushList();
        elements.push(
            new Paragraph({
                children: parseInlineFormatting(line),
                spacing: { after: 150 }
            })
        );
    }

    flushList();
    return elements;
}

/**
 * Parse inline markdown formatting (bold, italic, code)
 */
function parseInlineFormatting(text) {
    const runs = [];
    let remaining = text;

    while (remaining.length > 0) {
        // Bold **text** or __text__
        const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/);
        if (boldMatch) {
            if (boldMatch[1]) {
                runs.push(...parseInlineFormatting(boldMatch[1]));
            }
            runs.push(new TextRun({ text: boldMatch[2], bold: true }));
            remaining = remaining.substring(boldMatch[0].length);
            continue;
        }

        // Italic *text* or _text_
        const italicMatch = remaining.match(/^(.*?)\*(.+?)\*/);
        if (italicMatch) {
            if (italicMatch[1]) {
                runs.push(...parseInlineFormatting(italicMatch[1]));
            }
            runs.push(new TextRun({ text: italicMatch[2], italics: true }));
            remaining = remaining.substring(italicMatch[0].length);
            continue;
        }

        // Inline code `text`
        const codeMatch = remaining.match(/^(.*?)`(.+?)`/);
        if (codeMatch) {
            if (codeMatch[1]) {
                runs.push(new TextRun({ text: codeMatch[1] }));
            }
            runs.push(new TextRun({ text: codeMatch[2], font: 'Courier New', shading: { fill: 'F0F0F0' } }));
            remaining = remaining.substring(codeMatch[0].length);
            continue;
        }

        // No more formatting, add remaining text
        runs.push(new TextRun({ text: remaining }));
        break;
    }

    return runs;
}

/**
 * Generate and download a Word document from markdown content
 */
export async function downloadAsWord(markdownContent, filename = 'specifications.docx') {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    // Title
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Spécifications du Projet',
                                bold: true,
                                size: 48,
                                color: '2E74B5'
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 }
                    }),
                    // Date
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Généré le ${new Date().toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}`,
                                size: 22,
                                color: '666666'
                            })
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 600 }
                    }),
                    // Separator
                    new Paragraph({
                        border: {
                            bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E74B5' }
                        },
                        spacing: { after: 400 }
                    }),
                    // Content
                    ...parseMarkdownToDocx(markdownContent)
                ]
            }
        ]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename);
}
