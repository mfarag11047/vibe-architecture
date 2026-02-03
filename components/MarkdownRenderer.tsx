import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-cyan-400 prose-strong:text-cyan-200">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !className;
            return !isInline ? (
              <div className="relative group">
                <pre className="bg-slate-900/50 p-4 rounded-lg overflow-x-auto border border-slate-700/50 my-4">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-200 text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold border-b border-slate-700 pb-2 mb-4 mt-6 text-cyan-400" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-3 mt-6 text-cyan-300" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-semibold mb-2 mt-4 text-cyan-200" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 my-2 text-slate-300" {...props} />,
          li: ({node, ...props}) => <li className="pl-1" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};