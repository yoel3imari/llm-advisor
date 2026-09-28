import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import hljs from 'highlight.js/lib/common';
import { remarkGfmCompat } from '../../lib/remark-gfm-compat';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

class MarkdownErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackText: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallbackText: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[Markdown] Fallback to plain text due to rendering error:', error);
  }

  render() {
    if (this.state.hasError) {
      return <div className="whitespace-pre-wrap">{this.props.fallbackText}</div>;
    }
    return this.props.children;
  }
}

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

  const highlightedHtml = React.useMemo(() => {
    if (!code) return '';
    const cleanLang = (language || '').trim().toLowerCase();
    try {
      if (cleanLang && hljs.getLanguage(cleanLang)) {
        return hljs.highlight(code, { language: cleanLang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }, [code, language]);

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-3.5 py-2 bg-slate-50 dark:bg-slate-950/70 select-none">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {language || 'code'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          aria-label="Copy code"
          className="h-7 px-2.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors gap-1.5"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Copy</span>
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs sm:text-[13px] leading-relaxed font-mono custom-scrollbar text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
        <code className={language ? `hljs language-${language}` : 'hljs'}>
          <span className="sr-only select-none">{code}</span>
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        </code>
      </pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed text-slate-800 dark:text-slate-200">
      <MarkdownErrorBoundary fallbackText={content}>
        <ReactMarkdown
          remarkPlugins={[remarkGfmCompat]}
          components={{
            pre({ children }) {
              return <>{children}</>;
            },
            code({ className, children }) {
              const text = String(children ?? '').replace(/\n$/, '');
              const isBlock = /language-/.test(className ?? '') || text.includes('\n');
              if (!isBlock) {
                return (
                  <code className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 px-1.5 py-0.5 font-mono text-xs sm:text-[13px] text-slate-800 dark:text-slate-200">
                    {text}
                  </code>
                );
              }
              const language = (className ?? '').replace('language-', '');
              return <CodeBlock language={language} code={text} />;
            },
            h1({ children }) {
              return (
                <h1 className="mb-2 mt-4 text-lg font-bold text-slate-900 dark:text-white tracking-tight">{children}</h1>
              );
            },
            h2({ children }) {
              return (
                <h2 className="mb-2 mt-3.5 text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {children}
                </h2>
              );
            },
            h3({ children }) {
              return (
                <h3 className="mb-1.5 mt-2.5 text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{children}</h3>
              );
            },
            p({ children }) {
              return <p className="my-2 leading-relaxed">{children}</p>;
            },
            ul({ children }) {
              return <ul className="my-2 list-disc space-y-1.5 pl-6">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="my-2 list-decimal space-y-1.5 pl-6">{children}</ol>;
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
                  className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                >
                  {children}
                </a>
              );
            },
            table({ children }) {
              return (
                <div className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full border-collapse text-xs sm:text-sm">{children}</table>
                </div>
              );
            },
            th({ children }) {
              return (
                <th className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-850 px-3 py-2 text-left font-semibold text-slate-900 dark:text-slate-200">
                  {children}
                </th>
              );
            },
            td({ children }) {
              return (
                <td className="border-b border-slate-200 dark:border-slate-800 px-3 py-2 text-slate-700 dark:text-slate-300">
                  {children}
                </td>
              );
            },
            blockquote({ children }) {
              return (
                <blockquote className="my-2.5 border-l-2 border-indigo-500/60 pl-3.5 text-slate-600 dark:text-slate-400 italic">
                  {children}
                </blockquote>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    </div>
  );
}

export function cnMarkdownClass(extra?: string) {
  return cn('markdown-body', extra);
}
