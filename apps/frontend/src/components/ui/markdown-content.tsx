'use client';

import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert prose-headings:text-sm prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:bg-muted prose-pre:text-xs prose-code:text-xs prose-code:before:content-none prose-code:after:content-none ${className}`}>
      <ReactMarkdown
        components={{
          // Prevent tables — render as plain text
          table: ({ children }) => <div>{children}</div>,
          thead: ({ children }) => <>{children}</>,
          tbody: ({ children }) => <>{children}</>,
          tr: ({ children }) => <div>{children}</div>,
          th: ({ children }) => <span className="font-medium mr-2">{children}</span>,
          td: ({ children }) => <span className="mr-2">{children}</span>,
          // Keep links safe
          a: ({ href, children }) => (
            <span className="text-primary underline">{children}</span>
          ),
          // Prevent images
          img: () => null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
