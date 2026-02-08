import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import GeneratedContentFrame from './GeneratedContentFrame';

export default function ContentRenderer({ content, tokens, onCreateAnnotation, onCreateInteractive, onReplaceDraft, drafts }) {
  if (!content) return null;

  if (content.type === 'generated_html') {
    return (
      <GeneratedContentFrame
        html={content.html}
        tokens={tokens}
        onAnnotation={onCreateAnnotation}
        onInteractive={onCreateInteractive}
        onReplaceDraft={onReplaceDraft}
        drafts={drafts}
      />
    );
  }

  if (content.type === 'html') {
    return (
      <div
        style={styles.content}
        dangerouslySetInnerHTML={{ __html: content.body }}
      />
    );
  }

  return (
    <div style={styles.content}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children }) => <pre style={styles.pre}>{children}</pre>,
          code: ({ inline, className, children, ...props }) => {
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
          th: ({ children }) => <th style={styles.th}>{children}</th>,
          td: ({ children }) => <td style={styles.td}>{children}</td>,
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
        {content.body || ''}
      </ReactMarkdown>
    </div>
  );
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
    fontSize: '14px',
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
    fontSize: '14px',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--vds-colors-border)',
    fontSize: '15px',
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
