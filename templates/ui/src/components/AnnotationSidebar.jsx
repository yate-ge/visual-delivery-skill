function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AnnotationSidebar({ annotations }) {
  if (!annotations || annotations.length === 0) {
    return (
      <div style={styles.empty}>
        No annotations yet. Add a comment to share feedback on specific content.
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {[...annotations].reverse().map(a => (
        <div key={a.id} style={styles.item}>
          <div style={styles.itemHeader}>
            <span style={styles.type}>
              {a.target ? `Lines ${a.target.start}-${a.target.end}` : 'General comment'}
            </span>
            <span style={styles.time}>{timeAgo(a.created_at)}</span>
          </div>
          <p style={styles.content}>{a.content}</p>
        </div>
      ))}
    </div>
  );
}

const styles = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  item: {
    padding: '10px',
    background: 'var(--vds-colors-surface)',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  type: {
    fontSize: '11px',
    fontWeight: '500',
    color: 'var(--vds-colors-text-secondary)',
    textTransform: 'uppercase',
  },
  time: {
    fontSize: '11px',
    color: 'var(--vds-colors-text-secondary)',
  },
  content: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: 'var(--vds-colors-text)',
  },
  empty: {
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
    padding: '12px 0',
  },
};
