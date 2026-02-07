import { useState } from 'react';

export default function FeedbackSidebar({
  drafts,
  feedback,
  onRemoveDraft,
  onAddInteractive,
  onCommit,
  submitting,
}) {
  const [textInput, setTextInput] = useState('');

  const pendingFeedback = (feedback || []).filter((item) => item.handled === false);

  function handleAddInteractive() {
    if (!textInput.trim()) return;

    onAddInteractive({
      kind: 'interactive',
      payload: {
        text: textInput.trim(),
      },
      target: null,
    });

    setTextInput('');
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.header}>
        <h3 style={styles.title}>Feedback Sidebar</h3>
        <div style={styles.count}>{drafts.length} draft</div>
      </div>

      <div style={styles.section}>
        <label style={styles.sectionLabel}>Add direct feedback</label>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          rows={3}
          placeholder="Type feedback for the agent"
          style={styles.textarea}
        />
        <button onClick={handleAddInteractive} style={styles.secondaryBtn}>
          Add to Drafts
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionLabel}>Draft items</div>
        {drafts.length === 0 && <div style={styles.empty}>No draft feedback yet.</div>}
        {drafts.map((item) => (
          <div key={item.id} style={styles.item}>
            <div style={styles.itemTop}>
              <span style={styles.badge}>{item.kind}</span>
              <button onClick={() => onRemoveDraft(item.id)} style={styles.linkBtn}>Remove</button>
            </div>
            <pre style={styles.payload}>{JSON.stringify(item.payload, null, 2)}</pre>
          </div>
        ))}
      </div>

      <button
        onClick={onCommit}
        disabled={drafts.length === 0 || submitting}
        style={{
          ...styles.primaryBtn,
          ...(drafts.length === 0 || submitting ? styles.primaryBtnDisabled : {}),
        }}
      >
        {submitting ? 'Submitting...' : 'Confirm Submit'}
      </button>

      <div style={styles.section}>
        <div style={styles.sectionLabel}>Pending feedback for agent</div>
        {pendingFeedback.length === 0 && (
          <div style={styles.empty}>No pending feedback.</div>
        )}
        {pendingFeedback.map((item) => (
          <div key={item.id} style={styles.pendingItem}>
            <code style={styles.pendingId}>{item.id}</code>
            <span style={styles.pendingKind}>{item.kind}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 'min(340px, 100%)',
    flexShrink: 0,
    position: 'sticky',
    top: '16px',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '12px',
    background: 'var(--vds-colors-surface)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: 'calc(100vh - 48px)',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '15px',
    color: 'var(--vds-colors-text)',
  },
  count: {
    fontSize: '12px',
    color: 'var(--vds-colors-text-secondary)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--vds-colors-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
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
  secondaryBtn: {
    border: '1px solid var(--vds-colors-border)',
    background: 'white',
    color: 'var(--vds-colors-text)',
    borderRadius: '8px',
    padding: '8px 10px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    background: 'var(--vds-colors-primary)',
    color: 'white',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: '600',
    fontFamily: 'inherit',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  item: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '8px',
    background: 'white',
  },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  badge: {
    fontSize: '11px',
    textTransform: 'uppercase',
    color: 'var(--vds-colors-primary)',
    fontWeight: '600',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--vds-colors-danger)',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  payload: {
    fontSize: '11px',
    background: 'var(--vds-colors-surface)',
    borderRadius: '6px',
    padding: '6px',
    margin: 0,
    overflow: 'auto',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--vds-colors-text-secondary)',
  },
  pendingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid var(--vds-colors-border)',
    paddingBottom: '6px',
  },
  pendingId: {
    fontSize: '11px',
    color: 'var(--vds-colors-text-secondary)',
  },
  pendingKind: {
    fontSize: '11px',
    textTransform: 'uppercase',
    color: 'var(--vds-colors-text)',
  },
};
