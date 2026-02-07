import { useCallback, useEffect, useRef, useState } from 'react';
import { getBridgeScript } from '../lib/bridge';
import { tokensToCSS } from '../lib/theme';

function injectIntoHTML(html, tokens) {
  const bridgeScript = getBridgeScript();
  const tokenStyle = tokens
    ? `<style id="vd-design-tokens">${tokensToCSS(tokens)}</style>`
    : '';

  // Inject into <head> if present, otherwise prepend to html
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(
      /(<head[^>]*>)/i,
      `$1\n${tokenStyle}\n`
    ) + `\n${bridgeScript}`;
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(
      /(<html[^>]*>)/i,
      `$1<head>${tokenStyle}</head>`
    ) + `\n${bridgeScript}`;
  }

  // Bare HTML fragment — wrap it
  return `<!DOCTYPE html><html><head>${tokenStyle}</head><body>${html}${bridgeScript}</body></html>`;
}

export default function GeneratedContentFrame({ html, tokens, onAnnotation, onInteractive }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(400);

  // Handle postMessage from iframe
  const handleMessage = useCallback((e) => {
    if (!e.data || typeof e.data.type !== 'string') return;

    // Verify message is from our iframe
    const iframe = iframeRef.current;
    if (!iframe || e.source !== iframe.contentWindow) return;

    switch (e.data.type) {
      case 'vd:annotation':
        if (onAnnotation && e.data.payload) {
          onAnnotation(e.data.payload);
        }
        break;

      case 'vd:interactive':
        if (onInteractive && e.data.payload) {
          onInteractive(e.data.payload);
        }
        break;

      case 'vd:resize':
        if (typeof e.data.height === 'number' && e.data.height > 0) {
          setHeight(e.data.height);
        }
        break;
    }
  }, [onAnnotation, onInteractive]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Push token updates into iframe when tokens change
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow || !tokens) return;
    iframe.contentWindow.postMessage({
      type: 'vd:tokens-update',
      css: tokensToCSS(tokens),
    }, '*');
  }, [tokens]);

  if (!html) {
    return <div style={styles.empty}>No generated content.</div>;
  }

  const srcdoc = injectIntoHTML(html, tokens);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-scripts allow-same-origin"
      style={{ ...styles.iframe, height: `${height}px` }}
      title="Delivery content"
    />
  );
}

const styles = {
  iframe: {
    width: '100%',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '12px',
    background: '#fff',
    display: 'block',
    overflow: 'hidden',
    transition: 'height 0.15s ease',
  },
  empty: {
    border: '1px dashed var(--vds-colors-border)',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '15px',
  },
};
