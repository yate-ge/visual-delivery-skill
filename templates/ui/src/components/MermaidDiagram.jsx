import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'var(--vds-typography-font-family)',
  });
  mermaidInitialized = true;
}

let renderCounter = 0;

export default function MermaidDiagram({ content }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!content || !containerRef.current) return;

    initMermaid();

    const id = `mermaid-${++renderCounter}`;

    (async () => {
      try {
        const { svg } = await mermaid.render(id, content.trim());
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        setError(err.message || 'Failed to render diagram');
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      }
    })();
  }, [content]);

  if (error) {
    return (
      <div style={styles.error}>
        <div style={styles.errorTitle}>Diagram render error</div>
        <pre style={styles.errorPre}>{content}</pre>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.container} />
  );
}

const styles = {
  container: {
    margin: '16px 0',
    textAlign: 'center',
    overflow: 'auto',
  },
  error: {
    margin: '16px 0',
    padding: '12px',
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    borderRadius: 'var(--vds-spacing-border-radius)',
  },
  errorTitle: {
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: '8px',
    fontSize: '13px',
  },
  errorPre: {
    fontSize: '12px',
    fontFamily: 'var(--vds-typography-font-family-mono)',
    whiteSpace: 'pre-wrap',
    color: 'var(--vds-colors-text-secondary)',
  },
};
