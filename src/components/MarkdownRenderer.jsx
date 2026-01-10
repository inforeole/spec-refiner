import DOMPurify from 'dompurify';

/**
 * Rendu Markdown sécurisé avec DOMPurify
 * Sanitize tout le HTML généré pour prévenir les attaques XSS
 */
export default function MarkdownRenderer({ content }) {
    const renderMarkdown = (text) => {
        // Strip [AUDIO]...[/AUDIO] tags (used for TTS only)
        text = text.replace(/\[AUDIO\][\s\S]*?\[\/AUDIO\]\s*/gi, '');
        const lines = text.split('\n');
        const elements = [];
        let inList = false;
        let listItems = [];
        let inCodeBlock = false;
        let codeBlockLines = [];
        let inTable = false;
        let tableRows = [];

        // Configuration DOMPurify - autoriser les classes et les liens
        const purifyConfig = {
            ALLOWED_TAGS: ['a', 'strong', 'em', 'code'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
        };

        const sanitize = (html) => DOMPurify.sanitize(html, purifyConfig);

        const processInlineStyles = (line) => {
            // Links [text](url)
            line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:text-violet-300 underline">$1</a>');
            // Bold
            line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
            // Italic
            line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
            // Code
            line = line.replace(/`(.+?)`/g, '<code class="bg-slate-700 px-1.5 py-0.5 rounded text-violet-300 text-sm">$1</code>');
            return sanitize(line);
        };

        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={elements.length} className="space-y-2 my-4 ml-4">
                        {listItems.map((item, i) => (
                            <li key={i} className="flex gap-2 text-slate-300">
                                <span className="text-violet-400 mt-1">•</span>
                                <span dangerouslySetInnerHTML={{ __html: processInlineStyles(item) }} />
                            </li>
                        ))}
                    </ul>
                );
                listItems = [];
                inList = false;
            }
        };

        const flushCodeBlock = () => {
            if (codeBlockLines.length > 0) {
                elements.push(
                    <pre key={elements.length} className="bg-slate-900 border border-slate-700 rounded-lg p-4 my-4 overflow-x-auto">
                        <code className="text-sm text-slate-300 font-mono whitespace-pre">
                            {codeBlockLines.join('\n')}
                        </code>
                    </pre>
                );
                codeBlockLines = [];
            }
        };

        const parseTableRow = (row) => {
            return row
                .split('|')
                .slice(1, -1) // Enlever les | vides au début et à la fin
                .map(cell => cell.trim());
        };

        const isTableSeparator = (row) => {
            return /^\|[\s-:|]+\|$/.test(row);
        };

        const flushTable = () => {
            if (tableRows.length > 0) {
                const headerCells = parseTableRow(tableRows[0]);
                const dataRows = tableRows.slice(1).filter(row => !isTableSeparator(row));

                elements.push(
                    <div key={elements.length} className="overflow-x-auto my-4">
                        <table className="w-full border-collapse border border-slate-700 text-sm">
                            <thead>
                                <tr className="bg-slate-800">
                                    {headerCells.map((cell, i) => (
                                        <th key={i} className="border border-slate-700 px-3 py-2 text-left text-slate-200 font-semibold">
                                            <span dangerouslySetInnerHTML={{ __html: processInlineStyles(cell) }} />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {dataRows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-800/30'}>
                                        {parseTableRow(row).map((cell, cellIndex) => (
                                            <td key={cellIndex} className="border border-slate-700 px-3 py-2 text-slate-300">
                                                <span dangerouslySetInnerHTML={{ __html: processInlineStyles(cell) }} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
                tableRows = [];
                inTable = false;
            }
        };

        lines.forEach((line, index) => {
            // Gestion des blocs de code
            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    flushCodeBlock();
                    inCodeBlock = false;
                } else {
                    flushList();
                    inCodeBlock = true;
                }
                return;
            }

            if (inCodeBlock) {
                codeBlockLines.push(line);
                return;
            }

            // Gestion des tableaux
            const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|');
            if (isTableRow) {
                if (!inTable) {
                    flushList();
                    inTable = true;
                }
                tableRows.push(line);
                return;
            } else if (inTable) {
                flushTable();
            }

            // Headers (ordre du plus spécifique au moins spécifique)
            if (line.startsWith('#### ')) {
                flushList();
                elements.push(
                    <h4 key={index} className="text-base font-semibold text-slate-200 mt-4 mb-2">
                        {line.slice(5)}
                    </h4>
                );
            } else if (line.startsWith('### ')) {
                flushList();
                elements.push(
                    <h3 key={index} className="text-lg font-semibold text-violet-300 mt-6 mb-3">
                        {line.slice(4)}
                    </h3>
                );
            } else if (line.startsWith('## ')) {
                flushList();
                elements.push(
                    <h2 key={index} className="text-xl font-bold text-white mt-8 mb-4 pb-2 border-b border-slate-700">
                        {line.slice(3)}
                    </h2>
                );
            } else if (line.startsWith('# ')) {
                flushList();
                elements.push(
                    <h1 key={index} className="text-2xl font-bold text-white mb-6">
                        {line.slice(2)}
                    </h1>
                );
            }
            // Bullet list
            else if (line.match(/^[-*] /)) {
                if (!inList) {
                    inList = true;
                }
                listItems.push(line.slice(2));
            }
            // Numbered list
            else if (line.match(/^\d+\. /)) {
                if (!inList) {
                    inList = true;
                }
                listItems.push(line.replace(/^\d+\. /, ''));
            }
            // Horizontal rule
            else if (line.match(/^---+$/)) {
                flushList();
                elements.push(<hr key={index} className="border-slate-700 my-6" />);
            }
            // Empty line
            else if (line.trim() === '') {
                flushList();
            }
            // Regular paragraph
            else {
                flushList();
                elements.push(
                    <p
                        key={index}
                        className="text-slate-300 my-3 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: processInlineStyles(line) }}
                    />
                );
            }
        });

        flushList();
        flushCodeBlock();
        flushTable();
        return elements;
    };

    return <div>{renderMarkdown(content)}</div>;
}
