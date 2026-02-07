import { useEffect, useRef, useState } from 'react';

export default function SelectableSurface({ componentId, onCreateAnnotation, children }) {
  const rootRef = useRef(null);
  const [selectionState, setSelectionState] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    function onEscape(e) {
      if (e.key === 'Escape') {
        setSelectionState(null);
        setNote('');
      }
    }

    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, []);

  function handleMouseUp() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selection || !selectedText || selection.rangeCount === 0) {
      return;
    }

    const anchorNode = selection.anchorNode;
    if (!rootRef.current || !anchorNode || !rootRef.current.contains(anchorNode)) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionState({
      selectedText,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    });
  }

  function handleSubmit() {
    if (!selectionState || !note.trim()) return;

    onCreateAnnotation({
      kind: 'annotation',
      payload: {
        text: note.trim(),
        selected_text: selectionState.selectedText,
      },
      target: {
        component_id: componentId,
        target_type: 'selected_text',
        anchor: selectionState.selectedText,
      },
    });

    setSelectionState(null);
    setNote('');
    window.getSelection()?.removeAllRanges();
  }

  function dismissToolbar() {
    setSelectionState(null);
    setNote('');
  }

  return (
    <div ref={rootRef} onMouseUp={handleMouseUp} style={styles.surface}>
      {children}

      {selectionState && (
        <div style={{ ...styles.toolbar, left: selectionState.x, top: selectionState.y }}>
          <div style={styles.toolbarTitle}>Selected text</div>
          <div style={styles.selectedText}>{selectionState.selectedText}</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add feedback for this selection"
            rows={2}
            style={styles.textarea}
          />
          <div style={styles.actions}>
            <button onClick={handleSubmit} style={styles.submitBtn}>Add to sidebar</button>
            <button onClick={dismissToolbar} style={styles.cancelBtn}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  surface: {
    position: 'relative',
  },
  toolbar: {
    position: 'fixed',
    transform: 'translateX(-50%)',
    width: '300px',
    background: 'white',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
    padding: '10px',
    zIndex: 1000,
  },
  toolbarTitle: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    color: 'var(--vds-colors-text-secondary)',
    marginBottom: '6px',
  },
  selectedText: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: 'var(--vds-colors-text)',
    maxHeight: '56px',
    overflow: 'auto',
    marginBottom: '8px',
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '8px',
  },
  submitBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '6px 10px',
    background: 'var(--vds-colors-primary)',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  cancelBtn: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '6px 10px',
    background: 'white',
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
