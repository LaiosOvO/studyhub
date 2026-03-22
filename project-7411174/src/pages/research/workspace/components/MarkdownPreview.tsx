import ReactMarkdown from "react-markdown";

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <article
        className="prose prose-invert prose-sm max-w-none
          prose-headings:text-text-primary prose-headings:font-semibold
          prose-h1:text-lg prose-h1:border-b prose-h1:border-white/[0.08] prose-h1:pb-2
          prose-h2:text-base
          prose-h3:text-sm
          prose-a:text-accent-cyan prose-a:no-underline hover:prose-a:underline
          prose-code:text-accent-cyan prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-white/[0.06] prose-pre:border prose-pre:border-white/[0.08] prose-pre:rounded-lg
          prose-table:border-collapse
          prose-th:border prose-th:border-white/[0.08] prose-th:px-3 prose-th:py-1.5 prose-th:bg-white/[0.04] prose-th:text-xs
          prose-td:border prose-td:border-white/[0.08] prose-td:px-3 prose-td:py-1.5 prose-td:text-xs
          prose-blockquote:border-l-accent-cyan prose-blockquote:text-text-secondary
          prose-strong:text-text-primary
          prose-li:text-text-secondary
          prose-p:text-text-secondary"
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </article>
    </div>
  );
}
