// Note: dangerouslySetInnerHTML is used here for markdown rendering.
// Content comes from AI responses. Consider adding DOMPurify for extra safety.

export default function MarkdownRenderer({ content }) {
    const renderMarkdown = (text) => {
        const lines = text.split('\n');
        const elements = [];
        let inList = false;
        let listItems = [];

        const processInlineStyles = (line) => {
            // Links [text](url)
            line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-violet-400 hover:text-violet-300 underline">$1</a>');
            // Bold
            line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
            // Italic
            line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
            // Code
            line = line.replace(/`(.+?)`/g, '<code class="bg-slate-700 px-1.5 py-0.5 rounded text-violet-300 text-sm">$1</code>');
            return line;
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

        lines.forEach((line, index) => {
            // Headers
            if (line.startsWith('### ')) {
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
        return elements;
    };

    return <div>{renderMarkdown(content)}</div>;
}
