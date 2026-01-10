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
import { parseMarkdown } from '../services/markdownParserService';

/**
 * Transform InlineNode[] to TextRun[]
 */
function inlineNodesToTextRuns(nodes) {
    return nodes.map(node => {
        switch (node.type) {
            case 'text':
                return new TextRun({ text: node.content });
            case 'bold':
                return new TextRun({ text: node.content, bold: true });
            case 'italic':
                return new TextRun({ text: node.content, italics: true });
            case 'code':
                return new TextRun({
                    text: node.content,
                    font: 'Courier New',
                    shading: { fill: 'F0F0F0' }
                });
            case 'link':
                // DOCX TextRun doesn't support clickable links easily, render as text
                return new TextRun({ text: node.content });
            default:
                return new TextRun({ text: node.content || '' });
        }
    });
}

/**
 * Create a docx Table from AST table node
 */
function createDocxTable(tableNode) {
    const rows = [
        // Header row
        new TableRow({
            children: tableNode.headers.map(cell =>
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({
                                text: cell.children.map(n => n.content).join(''),
                                bold: true
                            })],
                            spacing: { after: 0 }
                        })
                    ],
                    shading: { fill: 'E8E8E8' },
                    verticalAlign: VerticalAlign.CENTER
                })
            )
        }),
        // Data rows
        ...tableNode.rows.map(row =>
            new TableRow({
                children: row.cells.map(cell =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: inlineNodesToTextRuns(cell.children),
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
        columnWidths: Array(tableNode.headers.length).fill(
            Math.floor(9000 / tableNode.headers.length)
        )
    });
}

/**
 * Heading level to size mapping
 */
const headingSizes = {
    1: { size: 36, before: 400, after: 200, heading: HeadingLevel.HEADING_1 },
    2: { size: 32, before: 300, after: 150, heading: HeadingLevel.HEADING_2 },
    3: { size: 28, before: 200, after: 100, heading: HeadingLevel.HEADING_3 },
    4: { size: 24, before: 150, after: 100, heading: HeadingLevel.HEADING_4 }
};

/**
 * Transform a single AST block node to DOCX element(s)
 */
function blockNodeToDocx(node) {
    switch (node.type) {
        case 'heading': {
            const config = headingSizes[node.level];
            return new Paragraph({
                children: [new TextRun({
                    text: node.children.map(n => n.content).join(''),
                    bold: true,
                    size: config.size
                })],
                heading: config.heading,
                spacing: { before: config.before, after: config.after }
            });
        }

        case 'paragraph':
            return new Paragraph({
                children: inlineNodesToTextRuns(node.children),
                spacing: { after: 150 }
            });

        case 'list':
            return node.items.map(item =>
                new Paragraph({
                    children: [
                        new TextRun({ text: '• ' }),
                        ...inlineNodesToTextRuns(item.children)
                    ],
                    indent: { left: 720 },
                    spacing: { after: 100 }
                })
            );

        case 'codeBlock':
            return new Paragraph({
                children: [
                    new TextRun({
                        text: node.content,
                        font: 'Courier New',
                        size: 20
                    })
                ],
                shading: { fill: 'F5F5F5' },
                spacing: { after: 200 }
            });

        case 'table': {
            const table = createDocxTable(node);
            return [table, new Paragraph({ spacing: { after: 200 } })];
        }

        case 'horizontalRule':
            return new Paragraph({
                border: {
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' }
                },
                spacing: { before: 200, after: 200 }
            });

        case 'emptyLine':
            return new Paragraph({ spacing: { after: 100 } });

        default:
            return null;
    }
}

/**
 * Parse markdown content and convert to docx paragraphs using AST
 */
export function parseMarkdownToDocx(markdown) {
    const ast = parseMarkdown(markdown);
    return ast.nodes
        .map(blockNodeToDocx)
        .flat()
        .filter(Boolean);
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
