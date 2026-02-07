import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import MermaidDiagram from './MermaidDiagram';

export default function ContentRenderer({ content }) {
  if (!content) return null;

  // HTML content type — render as self-contained HTML (supports embedded scripts)
  if (content.type === 'html') {
    return <HtmlRenderer html={content.body} />;
  }

  // Default: markdown with enhanced rendering
  return (
    <div style={styles.content}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children }) => (
            <pre style={styles.pre}>{children}</pre>
          ),
          code: ({ inline, className, children, ...props }) => {
            const text = String(children).replace(/\n$/, '');

            // Mermaid diagram support
            if (className === 'language-mermaid' || className?.includes('language-mermaid')) {
              return <MermaidDiagram content={text} />;
            }

            if (inline) {
              return <code style={styles.inlineCode} {...props}>{children}</code>;
            }
            return <code className={className} {...props}>{children}</code>;
          },
          table: ({ children }) => (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th style={styles.th}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={styles.td}>{children}</td>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={styles.link}>
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote style={styles.blockquote}>{children}</blockquote>
          ),
        }}
      >
        {content.body}
      </ReactMarkdown>
    </div>
  );
}

// HTML renderer with script execution support for rich interactive content
function HtmlRenderer({ html }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !html) return;

    // Set HTML
    ref.current.innerHTML = html;

    // Execute any <script> tags in the HTML content
    const scripts = ref.current.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      // Copy attributes
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      // Copy inline content
      if (oldScript.textContent) {
        newScript.textContent = oldScript.textContent;
      }
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }, [html]);

  return <div ref={ref} style={styles.content} />;
}

const styles = {
  content: {
    lineHeight: 'var(--vds-typography-line-height)',
    color: 'var(--vds-colors-text)',
  },
  pre: {
    background: 'var(--vds-colors-surface)',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    padding: '16px',
    overflow: 'auto',
    fontSize: '13px',
    fontFamily: 'var(--vds-typography-font-family-mono)',
    margin: '16px 0',
  },
  inlineCode: {
    background: 'var(--vds-colors-surface)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.9em',
    fontFamily: 'var(--vds-typography-font-family-mono)',
  },
  tableWrapper: {
    overflow: 'auto',
    margin: '16px 0',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '2px solid var(--vds-colors-border)',
    fontWeight: '600',
    fontSize: '13px',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--vds-colors-border)',
    fontSize: '14px',
  },
  link: {
    color: 'var(--vds-colors-primary)',
  },
  blockquote: {
    borderLeft: '3px solid var(--vds-colors-primary)',
    margin: '16px 0',
    padding: '8px 16px',
    color: 'var(--vds-colors-text-secondary)',
    background: 'var(--vds-colors-surface)',
    borderRadius: '0 var(--vds-spacing-border-radius) var(--vds-spacing-border-radius) 0',
  },
};
