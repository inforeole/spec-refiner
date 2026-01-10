import {
    Document,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Packer,
    BorderStyle,
    Table,
    TableRow,
    TableCell,
    WidthType,
    VerticalAlign
} from 'docx';
import { saveAs } from 'file-saver';

/**
 * Check if a line is a markdown table row
 */
function isTableRow(line) {
    return line.trim().startsWith('|') && line.trim().endsWith('|');
}

/**
 * Check if a line is a table separator (|---|---|)
 */
function isTableSeparator(line) {
    return /^\|[\s\-:|]+\|$/.test(line.trim());
}

/**
 * Parse a table row into cells
 */
function parseTableCells(row) {
    return row
        .split('|')
        .slice(1, -1) // Remove empty strings from start/end
        .map(cell => cell.trim());
}

/**
 * Create a docx Table from markdown table rows
 */
function createTable(tableRows) {
    if (tableRows.length === 0) return null;

    const headerCells = parseTableCells(tableRows[0]);
    const dataRows = tableRows.slice(1).filter(row => !isTableSeparator(row));

    const rows = [
        // Header row
        new TableRow({
            children: headerCells.map(cell => {
                // Strip ** from header cells and parse inline formatting
                const cleanCell = cell.replace(/^\*\*|\*\*$/g, '');
                return new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: cleanCell, bold: true })],
                            spacing: { after: 0 }
                        })
                    ],
                    shading: { fill: 'E8E8E8' },
                    verticalAlign: VerticalAlign.CENTER
                });
            })
        }),
        // Data rows
        ...dataRows.map(row =>
            new TableRow({
                children: parseTableCells(row).map(cell =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: parseInlineFormatting(cell),
                                spacing: { after: 0 }
                            })
                        ],
                        verticalAlign: VerticalAlign.CENTER
                    })
                )
            })
        )
    ];

    return new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: Array(headerCells.length).fill(Math.floor(9000 / headerCells.length))
    });
}

/**
 * Parse markdown content and convert to docx paragraphs
 */
export function parseMarkdownToDocx(markdown) {
    const lines = markdown.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBlockContent = [];
    let listItems = [];
    let tableRows = [];
    let inTable = false;
    let lastWasEmpty = false; // Track consecutive empty lines

    const flushTable = () => {
        if (tableRows.length > 0) {
            const table = createTable(tableRows);
            if (table) {
                elements.push(table);
                elements.push(new Paragraph({ spacing: { after: 200 } }));
            }
            tableRows = [];
            inTable = false;
        }
    };

    const flushList = () => {
        if (listItems.length > 0) {
            listItems.forEach(item => {
                elements.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: '• ' }),
                            ...parseInlineFormatting(item)
                        ],
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

        // Table handling
        if (isTableRow(line)) {
            if (!inTable) {
                flushList();
                inTable = true;
            }
            tableRows.push(line);
            continue;
        } else if (inTable) {
            flushTable();
        }

        // Empty line - skip consecutive empty lines
        if (line.trim() === '') {
            flushList();
            flushTable();
            if (!lastWasEmpty) {
                elements.push(new Paragraph({ spacing: { after: 100 } }));
                lastWasEmpty = true;
            }
            continue;
        }
        lastWasEmpty = false;

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

        // Horizontal rule
        if (line.match(/^-{3,}$/)) {
            flushList();
            elements.push(
                new Paragraph({
                    border: {
                        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' }
                    },
                    spacing: { before: 200, after: 200 }
                })
            );
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
    flushTable();
    return elements;
}

/**
 * Parse inline markdown formatting (bold, italic, code)
 */
export function parseInlineFormatting(text) {
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
