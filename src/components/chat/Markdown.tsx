import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="text-[11px] font-medium text-zinc-400">
          {language || 'code'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          aria-label="Copy code"
          className="h-7 px-2"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body text-xs leading-relaxed text-zinc-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children }) {
            const text = String(children ?? '').replace(/\n$/, '');
            const isBlock = /language-/.test(className ?? '') || text.includes('\n');
            if (!isBlock) {
              return (
                <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[11px] text-zinc-100">
                  {text}
                </code>
              );
            }
            const language = (className ?? '').replace('language-', '');
            return <CodeBlock language={language} code={text} />;
          },
          h1({ children }) {
            return (
              <h1 className="mb-2 mt-3 text-sm font-semibold text-white">{children}</h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="mb-1.5 mt-2.5 text-[13px] font-semibold text-white">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="mb-1 mt-2 text-xs font-semibold text-white">{children}</h3>
            );
          },
          p({ children }) {
            return <p className="my-1.5">{children}</p>;
          },
          ul({ children }) {
            return <ul className="my-1.5 list-disc space-y-1 pl-5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline hover:text-indigo-300"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-2 overflow-x-auto rounded-lg border border-zinc-800">
                <table className="w-full border-collapse text-xs">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border-b border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-left font-medium text-zinc-200">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border-b border-zinc-800 px-2.5 py-1.5 text-zinc-300">
                {children}
              </td>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 border-l-2 border-zinc-700 pl-3 text-zinc-400">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function cnMarkdownClass(extra?: string) {
  return cn('markdown-body', extra);
}
