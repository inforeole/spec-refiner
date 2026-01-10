/**
 * Markdown Parser Service
 * Parse markdown into platform-agnostic AST for consumption by MarkdownRenderer and wordExport
 */

/**
 * Check if line is a table row
 * @param {string} line
 * @returns {boolean}
 */
export function isTableRow(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|');
}

/**
 * Check if line is a table separator (|---|---|)
 * @param {string} line
 * @returns {boolean}
 */
export function isTableSeparator(line) {
    return /^\|[\s\-:|]+\|$/.test(line.trim());
}

/**
 * Parse table row into cell contents
 * @param {string} row
 * @returns {string[]}
 */
export function parseTableCells(row) {
    return row.split('|').slice(1, -1).map(cell => cell.trim());
}

/**
 * Detect header level (1-4) or null
 * @param {string} line
 * @returns {{ level: number, content: string } | null}
 */
export function detectHeader(line) {
    const match = line.match(/^(#{1,4})\s+(.*)$/);
    if (!match) return null;
    return { level: match[1].length, content: match[2] };
}

/**
 * Detect list item or null
 * @param {string} line
 * @returns {{ type: 'unordered' | 'ordered', content: string } | null}
 */
export function detectListItem(line) {
    if (line.match(/^[-*]\s/)) {
        return { type: 'unordered', content: line.substring(2).trim() };
    }
    const numbered = line.match(/^\d+\.\s(.*)$/);
    if (numbered) {
        return { type: 'ordered', content: numbered[1].trim() };
    }
    return null;
}

/**
 * Parse inline markdown formatting into InlineNode array
 * Handles: bold (**), italic (*), code (`), links [text](url)
 * @param {string} text
 * @returns {Array<{type: string, content: string, href?: string}>}
 */
export function parseInlineContent(text) {
    const nodes = [];
    let remaining = text;

    while (remaining.length > 0) {
        // Link [text](url)
        const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
            if (linkMatch[1]) {
                nodes.push(...parseInlineContent(linkMatch[1]));
            }
            nodes.push({ type: 'link', content: linkMatch[2], href: linkMatch[3] });
            remaining = remaining.substring(linkMatch[0].length);
            continue;
        }

        // Bold **text**
        const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/);
        if (boldMatch) {
            if (boldMatch[1]) {
                nodes.push(...parseInlineContent(boldMatch[1]));
            }
            nodes.push({ type: 'bold', content: boldMatch[2] });
            remaining = remaining.substring(boldMatch[0].length);
            continue;
        }

        // Italic *text*
        const italicMatch = remaining.match(/^(.*?)\*(.+?)\*/);
        if (italicMatch) {
            if (italicMatch[1]) {
                nodes.push(...parseInlineContent(italicMatch[1]));
            }
            nodes.push({ type: 'italic', content: italicMatch[2] });
            remaining = remaining.substring(italicMatch[0].length);
            continue;
        }

        // Inline code `text`
        const codeMatch = remaining.match(/^(.*?)`(.+?)`/);
        if (codeMatch) {
            if (codeMatch[1]) {
                nodes.push({ type: 'text', content: codeMatch[1] });
            }
            nodes.push({ type: 'code', content: codeMatch[2] });
            remaining = remaining.substring(codeMatch[0].length);
            continue;
        }

        // No more formatting, add remaining text
        nodes.push({ type: 'text', content: remaining });
        break;
    }

    return nodes;
}

/**
 * Parse markdown text into a platform-agnostic AST
 * @param {string} markdown - Raw markdown text
 * @param {Object} [options] - Parsing options
 * @param {boolean} [options.stripAudioTags=false] - Remove [AUDIO]...[/AUDIO] tags
 * @param {boolean} [options.collapseEmptyLines=true] - Collapse consecutive empty lines
 * @returns {{ nodes: Array }}
 */
export function parseMarkdown(markdown, options = {}) {
    const { stripAudioTags = false, collapseEmptyLines = true } = options;

    // Pre-process: strip audio tags if requested
    let text = markdown;
    if (stripAudioTags) {
        text = text.replace(/\[AUDIO\][\s\S]*?\[\/AUDIO\]\s*/gi, '');
    }

    const lines = text.split('\n');
    const nodes = [];

    // State tracking
    let inCodeBlock = false;
    let codeBlockLanguage = '';
    let codeBlockContent = [];
    let inTable = false;
    let tableRows = [];
    let inList = false;
    let listType = null;
    let listItems = [];
    let lastWasEmpty = false;

    const flushList = () => {
        if (listItems.length > 0) {
            nodes.push({
                type: 'list',
                listType,
                items: listItems.map(content => ({
                    children: parseInlineContent(content)
                }))
            });
            listItems = [];
            inList = false;
            listType = null;
        }
    };

    const flushTable = () => {
        if (tableRows.length > 0) {
            const headerCells = parseTableCells(tableRows[0]);
            const dataRows = tableRows.slice(1).filter(row => !isTableSeparator(row));

            nodes.push({
                type: 'table',
                headers: headerCells.map(cell => ({
                    children: parseInlineContent(cell.replace(/^\*\*|\*\*$/g, ''))
                })),
                rows: dataRows.map(row => ({
                    cells: parseTableCells(row).map(cell => ({
                        children: parseInlineContent(cell)
                    }))
                }))
            });
            tableRows = [];
            inTable = false;
        }
    };

    const flushCodeBlock = () => {
        if (codeBlockContent.length > 0) {
            nodes.push({
                type: 'codeBlock',
                language: codeBlockLanguage,
                content: codeBlockContent.join('\n')
            });
            codeBlockContent = [];
            codeBlockLanguage = '';
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Code block handling
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                flushCodeBlock();
                inCodeBlock = false;
            } else {
                flushList();
                inCodeBlock = true;
                codeBlockLanguage = line.slice(3).trim();
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

        // Empty line
        if (line.trim() === '') {
            flushList();
            flushTable();
            if (!collapseEmptyLines || !lastWasEmpty) {
                nodes.push({ type: 'emptyLine' });
                lastWasEmpty = true;
            }
            continue;
        }
        lastWasEmpty = false;

        // Headers
        const header = detectHeader(line);
        if (header) {
            flushList();
            nodes.push({
                type: 'heading',
                level: header.level,
                children: parseInlineContent(header.content)
            });
            continue;
        }

        // List items
        const listItem = detectListItem(line);
        if (listItem) {
            if (!inList) {
                inList = true;
                listType = listItem.type;
            }
            listItems.push(listItem.content);
            continue;
        }

        // Horizontal rule
        if (line.match(/^-{3,}$/)) {
            flushList();
            nodes.push({ type: 'horizontalRule' });
            continue;
        }

        // Regular paragraph
        flushList();
        nodes.push({
            type: 'paragraph',
            children: parseInlineContent(line)
        });
    }

    // Flush remaining content
    flushList();
    flushTable();
    flushCodeBlock();

    return { nodes };
}
