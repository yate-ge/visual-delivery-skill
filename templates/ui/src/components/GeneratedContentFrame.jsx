import { useCallback, useEffect, useRef, useState } from 'react';
import { getBridgeScript } from '../lib/bridge';
import { getLang } from '../lib/i18n';
import { tokensToCSS } from '../lib/theme';

function injectIntoHTML(html, tokens, lang) {
  const bridgeScript = getBridgeScript(lang);
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

export default function GeneratedContentFrame({ html, tokens, onAnnotation, onInteractive, onReplaceDraft, drafts }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(400);
  const prevDraftsRef = useRef([]);

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

      case 'vd:interactive-replace':
        // Mutual exclusion: remove old draft for same item-id, different action
        if (onReplaceDraft && e.data.oldAction && e.data.itemId) {
          onReplaceDraft(e.data.oldAction, e.data.itemId);
        }
        break;

      case 'vd:resize':
        if (typeof e.data.height === 'number' && e.data.height > 0) {
          setHeight(e.data.height);
        }
        break;
    }
  }, [onAnnotation, onInteractive, onReplaceDraft]);

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

  // Detect draft removals and send reset messages to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const prevDrafts = prevDraftsRef.current;
    const currentIds = new Set((drafts || []).map((d) => d.id));

    // Find drafts that were in prev but not in current (removed)
    for (const prev of prevDrafts) {
      if (!currentIds.has(prev.id) && prev.kind === 'interactive' && prev.payload?.action) {
        iframe.contentWindow.postMessage({
          type: 'vd:feedback-reset',
          action: prev.payload.action,
          itemId: prev.payload['item-id'] || '',
        }, '*');
      }
    }

    prevDraftsRef.current = drafts || [];
  }, [drafts]);

  if (!html) {
    return <div style={styles.empty}>No generated content.</div>;
  }

  const srcdoc = injectIntoHTML(html, tokens, getLang());

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ ...styles.iframe, height: `${height}px` }}
      title="Delivery content"
    />
  );
}

const styles = {
  iframe: {
    width: '100%',
    border: 'none',
    background: '#fff',
    display: 'block',
    overflow: 'hidden',
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
