import { useState } from 'react';
import { t } from '../../lib/i18n';

function DraftAnnotationItem({ item, onRemove }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.badge, ...styles.badgeAnnotation }}>{t('annotationLabel')}</span>
        <button onClick={() => onRemove(item.id)} style={styles.removeBtn}>{t('remove')}</button>
      </div>
      {item.payload?.selected_text && (
        <div style={styles.quote}>
          <span style={styles.quoteIcon}>&ldquo;</span>
          {item.payload.selected_text.length > 80
            ? item.payload.selected_text.slice(0, 80) + '...'
            : item.payload.selected_text}
        </div>
      )}
      {item.payload?.text && (
        <div style={styles.noteText}>{item.payload.text}</div>
      )}
    </div>
  );
}

function DraftInteractiveItem({ item, onRemove }) {
  const action = item.payload?.action || '';
  const label = item.target?.anchor || action;
  const fields = item.payload?.fields;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.badge, ...styles.badgeInteractive }}>{t('interactiveLabel')}</span>
        <button onClick={() => onRemove(item.id)} style={styles.removeBtn}>{t('remove')}</button>
      </div>
      <div style={styles.actionRow}>
        <span style={styles.actionLabel}>{label}</span>
        {action && <code style={styles.actionCode}>{action}</code>}
      </div>
      {fields && Object.keys(fields).length > 0 && (
        <div style={styles.fieldsBlock}>
          <span style={styles.fieldsTitle}>{t('fieldsLabel')}:</span>
          {Object.entries(fields).map(([k, v]) => (
            <div key={k} style={styles.fieldRow}>
              <span style={styles.fieldKey}>{k}:</span>
              <span style={styles.fieldVal}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DraftDirectItem({ item, onRemove }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.badge, ...styles.badgeDirect }}>{t('directLabel')}</span>
        <button onClick={() => onRemove(item.id)} style={styles.removeBtn}>{t('remove')}</button>
      </div>
      {item.payload?.text && (
        <div style={styles.noteText}>{item.payload.text}</div>
      )}
    </div>
  );
}

function DraftItem({ item, onRemove }) {
  if (item.kind === 'annotation') {
    return <DraftAnnotationItem item={item} onRemove={onRemove} />;
  }
  if (item.kind === 'interactive' && item.payload?.action) {
    return <DraftInteractiveItem item={item} onRemove={onRemove} />;
  }
  return <DraftDirectItem item={item} onRemove={onRemove} />;
}

function PendingFeedbackItem({ item, onRevoke }) {
  const isAnnotation = item.kind === 'annotation';
  const action = item.payload?.action || '';
  const label = item.target?.anchor || action || '';
  const fields = item.payload?.fields;

  return (
    <div style={styles.pendingCard}>
      <div style={styles.cardHeader}>
        <div style={styles.pendingBadgeRow}>
          <span style={{
            ...styles.badge,
            ...(isAnnotation ? styles.badgeAnnotation : styles.badgeInteractive),
          }}>
            {isAnnotation ? t('annotationLabel') : t('interactiveLabel')}
          </span>
          <span style={styles.pendingDot}>{t('pendingBadge')}</span>
        </div>
        {onRevoke && (
          <button onClick={() => onRevoke(item.id)} style={styles.revokeBtn}>
            {t('revoke')}
          </button>
        )}
      </div>

      {isAnnotation && item.payload?.selected_text && (
        <div style={styles.quote}>
          <span style={styles.quoteIcon}>&ldquo;</span>
          {item.payload.selected_text.length > 80
            ? item.payload.selected_text.slice(0, 80) + '...'
            : item.payload.selected_text}
        </div>
      )}
      {item.payload?.text && (
        <div style={styles.noteText}>{item.payload.text}</div>
      )}
      {!isAnnotation && label && (
        <div style={styles.actionRow}>
          <span style={styles.actionLabel}>{label}</span>
          {action && <code style={styles.actionCode}>{action}</code>}
        </div>
      )}
      {fields && Object.keys(fields).length > 0 && (
        <div style={styles.fieldsBlock}>
          <span style={styles.fieldsTitle}>{t('fieldsLabel')}:</span>
          {Object.entries(fields).map(([k, v]) => (
            <div key={k} style={styles.fieldRow}>
              <span style={styles.fieldKey}>{k}:</span>
              <span style={styles.fieldVal}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeedbackSidebar({
  drafts,
  feedback,
  onRemoveDraft,
  onAddInteractive,
  onCommit,
  onRevoke,
  submitting,
}) {
  const [textInput, setTextInput] = useState('');

  const pendingFeedback = (feedback || []).filter((item) => item.handled === false);

  function handleAddDirect() {
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

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAddDirect();
    }
  }

  return (
    <aside style={styles.sidebar}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>{t('feedbackSidebar')}</h3>
        {drafts.length > 0 && (
          <span style={styles.draftBadge}>{drafts.length}</span>
        )}
      </div>

      {/* Direct feedback input */}
      <div style={styles.section}>
        <label style={styles.sectionLabel}>{t('addDirectFeedback')}</label>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={t('typeFeedbackPlaceholder')}
          style={styles.textarea}
        />
        <button onClick={handleAddDirect} style={styles.secondaryBtn}>
          {t('addToDrafts')}
        </button>
      </div>

      {/* Draft items */}
      {drafts.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>{t('draftItems')}</div>
          <div style={styles.cardList}>
            {drafts.map((item) => (
              <DraftItem key={item.id} item={item} onRemove={onRemoveDraft} />
            ))}
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={onCommit}
        disabled={drafts.length === 0 || submitting}
        style={{
          ...styles.primaryBtn,
          ...(drafts.length === 0 || submitting ? styles.primaryBtnDisabled : {}),
        }}
      >
        {submitting ? t('submitting') : t('confirmSubmit')}
        {drafts.length > 0 && !submitting && ` (${drafts.length})`}
      </button>

      {/* Pending feedback */}
      {pendingFeedback.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>
            {t('pendingFeedbackForAgent')}
            <span style={styles.pendingCount}>{pendingFeedback.length}</span>
          </div>
          <div style={styles.cardList}>
            {pendingFeedback.map((item) => (
              <PendingFeedbackItem
                key={item.id}
                item={item}
                onRevoke={onRevoke}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no drafts and no pending */}
      {drafts.length === 0 && pendingFeedback.length === 0 && (
        <div style={styles.emptyState}>
          {t('noDraftFeedback')}
        </div>
      )}
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
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    maxHeight: 'calc(100vh - 48px)',
    overflow: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--vds-colors-text)',
    margin: 0,
  },
  draftBadge: {
    background: 'var(--vds-colors-primary, #3b82f6)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '700',
    borderRadius: '999px',
    minWidth: '22px',
    height: '22px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
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
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    lineHeight: '1.5',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  secondaryBtn: {
    border: '1px solid var(--vds-colors-border)',
    background: 'white',
    color: 'var(--vds-colors-text)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: '500',
    transition: 'background 0.15s',
  },
  primaryBtn: {
    border: 'none',
    borderRadius: '8px',
    padding: '11px 14px',
    background: 'var(--vds-colors-primary, #3b82f6)',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '600',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '10px',
    padding: '10px 12px',
    background: 'white',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pendingCard: {
    border: '1px solid #fcd34d',
    borderRadius: '10px',
    padding: '10px 12px',
    background: '#fffef5',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  badge: {
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '6px',
    padding: '2px 8px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  badgeAnnotation: {
    background: '#ede9fe',
    color: '#6d28d9',
  },
  badgeInteractive: {
    background: '#dbeafe',
    color: '#1d4ed8',
  },
  badgeDirect: {
    background: '#f0fdf4',
    color: '#15803d',
  },
  pendingDot: {
    fontSize: '11px',
    color: '#92400e',
    fontWeight: '500',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '2px 4px',
    borderRadius: '4px',
    transition: 'color 0.15s',
  },
  revokeBtn: {
    background: 'none',
    border: '1px solid #fca5a5',
    color: '#dc2626',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '3px 8px',
    borderRadius: '6px',
    fontWeight: '500',
    transition: 'background 0.15s',
  },
  quote: {
    fontSize: '13px',
    fontStyle: 'italic',
    color: 'var(--vds-colors-text-secondary)',
    lineHeight: '1.45',
    paddingLeft: '12px',
    borderLeft: '3px solid #c4b5fd',
    position: 'relative',
  },
  quoteIcon: {
    fontSize: '18px',
    color: '#a78bfa',
    marginRight: '2px',
    lineHeight: '1',
  },
  noteText: {
    fontSize: '13px',
    color: 'var(--vds-colors-text)',
    lineHeight: '1.5',
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  actionLabel: {
    fontSize: '13px',
    color: 'var(--vds-colors-text)',
    fontWeight: '500',
  },
  actionCode: {
    fontSize: '11px',
    background: 'var(--vds-colors-surface, #f1f5f9)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: 'var(--vds-colors-text-secondary)',
    fontFamily: 'var(--vds-typography-font-family-mono, monospace)',
  },
  fieldsBlock: {
    fontSize: '12px',
    background: 'var(--vds-colors-surface, #f8fafc)',
    borderRadius: '6px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  fieldsTitle: {
    fontWeight: '600',
    color: 'var(--vds-colors-text-secondary)',
    marginBottom: '2px',
  },
  fieldRow: {
    display: 'flex',
    gap: '6px',
  },
  fieldKey: {
    color: 'var(--vds-colors-text-secondary)',
    fontFamily: 'var(--vds-typography-font-family-mono, monospace)',
  },
  fieldVal: {
    color: 'var(--vds-colors-text)',
    wordBreak: 'break-word',
  },
  pendingCount: {
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '11px',
    fontWeight: '700',
    borderRadius: '999px',
    minWidth: '18px',
    height: '18px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px',
  },
  emptyState: {
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
    textAlign: 'center',
    padding: '16px 0',
  },
};
