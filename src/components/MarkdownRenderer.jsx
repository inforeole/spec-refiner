import DOMPurify from 'dompurify';
import { parseMarkdown } from '../services/markdownParserService';

// DOMPurify config - allow classes and links
const purifyConfig = {
    ALLOWED_TAGS: ['a', 'strong', 'em', 'code'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
};

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Transform InlineNode[] to sanitized HTML string
 * All output is sanitized with DOMPurify before rendering
 */
function inlineNodesToHtml(nodes) {
    const html = nodes.map(node => {
        switch (node.type) {
            case 'text':
                return escapeHtml(node.content);
            case 'bold':
                return `<strong class="text-white font-semibold">${escapeHtml(node.content)}</strong>`;
            case 'italic':
                return `<em>${escapeHtml(node.content)}</em>`;
            case 'code':
                return `<code class="bg-slate-700 px-1.5 py-0.5 rounded text-violet-300 text-sm">${escapeHtml(node.content)}</code>`;
            case 'link':
                return `<a href="${escapeHtml(node.href)}" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:text-violet-300 underline">${escapeHtml(node.content)}</a>`;
            default:
                return escapeHtml(node.content || '');
        }
    }).join('');
    return DOMPurify.sanitize(html, purifyConfig);
}

/**
 * Render a single AST block node
 * Uses DOMPurify-sanitized HTML for inline content
 */
function BlockRenderer({ node, nodeKey }) {
    switch (node.type) {
        case 'heading': {
            const classes = {
                1: 'text-2xl font-bold text-white mb-6',
                2: 'text-xl font-bold text-white mt-8 mb-4 pb-2 border-b border-slate-700',
                3: 'text-lg font-semibold text-violet-300 mt-6 mb-3',
                4: 'text-base font-semibold text-slate-200 mt-4 mb-2'
            };
            const Tag = `h${node.level}`;
            // Content sanitized by inlineNodesToHtml using DOMPurify
            return (
                <Tag
                    key={nodeKey}
                    className={classes[node.level]}
                    dangerouslySetInnerHTML={{ __html: inlineNodesToHtml(node.children) }}
                />
            );
        }

        case 'paragraph':
            // Content sanitized by inlineNodesToHtml using DOMPurify
            return (
                <p
                    key={nodeKey}
                    className="text-slate-300 my-3 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: inlineNodesToHtml(node.children) }}
                />
            );

        case 'list':
            return (
                <ul key={nodeKey} className="space-y-2 my-4 ml-4">
                    {node.items.map((item, i) => (
                        <li key={i} className="flex gap-2 text-slate-300">
                            <span className="text-violet-400 mt-1">•</span>
                            {/* Content sanitized by inlineNodesToHtml using DOMPurify */}
                            <span dangerouslySetInnerHTML={{ __html: inlineNodesToHtml(item.children) }} />
                        </li>
                    ))}
                </ul>
            );

        case 'codeBlock':
            return (
                <pre key={nodeKey} className="bg-slate-900 border border-slate-700 rounded-lg p-4 my-4 overflow-x-auto">
                    <code className="text-sm text-slate-300 font-mono whitespace-pre">
                        {node.content}
                    </code>
                </pre>
            );

        case 'table':
            return (
                <div key={nodeKey} className="overflow-x-auto my-4">
                    <table className="w-full border-collapse border border-slate-700 text-sm">
                        <thead>
                            <tr className="bg-slate-800">
                                {node.headers.map((cell, i) => (
                                    <th key={i} className="border border-slate-700 px-3 py-2 text-left text-slate-200 font-semibold">
                                        {/* Content sanitized by inlineNodesToHtml using DOMPurify */}
                                        <span dangerouslySetInnerHTML={{ __html: inlineNodesToHtml(cell.children) }} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {node.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-800/30'}>
                                    {row.cells.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="border border-slate-700 px-3 py-2 text-slate-300">
                                            {/* Content sanitized by inlineNodesToHtml using DOMPurify */}
                                            <span dangerouslySetInnerHTML={{ __html: inlineNodesToHtml(cell.children) }} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );

        case 'horizontalRule':
            return <hr key={nodeKey} className="border-slate-700 my-6" />;

        case 'emptyLine':
            return null;

        default:
            return null;
    }
}

/**
 * Secure Markdown Renderer using AST parsing
 * Sanitizes all generated HTML with DOMPurify to prevent XSS attacks
 */
export default function MarkdownRenderer({ content }) {
    const ast = parseMarkdown(content, { stripAudioTags: true });

    return (
        <div>
            {ast.nodes.map((node, index) => (
                <BlockRenderer key={index} node={node} nodeKey={index} />
            ))}
        </div>
    );
}
