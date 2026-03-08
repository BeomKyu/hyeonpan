import './DiffBlock.css';

interface DiffBlockProps {
    diffText: string;
}

export function DiffBlock({ diffText }: DiffBlockProps) {
    const lines = diffText.split('\n');

    return (
        <div className="diff-container">
            <div className="diff-header">변경사항</div>
            <pre className="diff-content">
                {lines.map((line, i) => {
                    let className = 'diff-line-context';
                    if (line.startsWith('+')) className = 'diff-line-add';
                    else if (line.startsWith('-')) className = 'diff-line-remove';
                    else if (line.startsWith('@@')) className = 'diff-line-hunk';
                    return (
                        <div key={i} className={className}>
                            {line}
                        </div>
                    );
                })}
            </pre>
        </div>
    );
}
