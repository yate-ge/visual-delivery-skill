import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDeliveries } from '../hooks/useDeliveries';

const MODE_FILTERS = ['all', 'passive', 'interactive', 'blocking'];

const STATUS_ICONS = {
  delivered: '\u25CB',
  awaiting_feedback: '\u25CF',
  completed: '\u2713',
  timeout: '\u25CB'
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const { deliveries, loading, error } = useDeliveries();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? deliveries
    : deliveries.filter(d => d.mode === filter);

  // Sort: blocking first, then by created_at desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.mode === 'blocking' && a.status === 'awaiting_feedback') return -1;
    if (b.mode === 'blocking' && b.status === 'awaiting_feedback') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const blockingDeliveries = deliveries.filter(
    d => d.mode === 'blocking' && d.status === 'awaiting_feedback'
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Visual Delivery</h1>
        <Link to="/settings" style={styles.settingsLink}>Settings</Link>
      </header>

      {blockingDeliveries.length > 0 && (
        <div style={styles.blockingAlert}>
          <div style={styles.blockingAlertIcon}>!</div>
          <div style={styles.blockingAlertContent}>
            <strong>Agent is waiting for your response</strong>
            <div style={styles.blockingAlertLinks}>
              {blockingDeliveries.map(d => (
                <Link key={d.id} to={`/d/${d.id}`} style={styles.blockingAlertLink}>
                  {d.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={styles.filters}>
        {MODE_FILTERS.map(m => (
          <button
            key={m}
            onClick={() => setFilter(m)}
            style={{
              ...styles.filterBtn,
              ...(filter === m ? styles.filterBtnActive : {})
            }}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div style={styles.empty}>Loading deliveries...</div>}
      {error && <div style={styles.error}>Error: {error}</div>}
      {!loading && sorted.length === 0 && (
        <div style={styles.empty}>No deliveries yet. The agent will create them as needed.</div>
      )}

      <div style={styles.list}>
        {sorted.map(d => (
          <Link key={d.id} to={`/d/${d.id}`} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.statusIcon}>{STATUS_ICONS[d.status] || '\u25CB'}</span>
              <span style={styles.cardTitle}>{d.title}</span>
              <span style={{
                ...styles.badge,
                ...(d.mode === 'blocking' ? styles.badgeBlocking :
                    d.mode === 'interactive' ? styles.badgeInteractive :
                    styles.badgePassive)
              }}>
                {d.mode}
              </span>
            </div>
            <div style={styles.cardMeta}>
              <span>{d.status.replace('_', ' ')}</span>
              <span>{timeAgo(d.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: 'var(--vds-spacing-page-padding)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: 'var(--vds-colors-text)',
  },
  settingsLink: {
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '14px',
  },
  blockingAlert: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: 'var(--vds-colors-blocking-bg)',
    border: '1px solid var(--vds-colors-blocking-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    marginBottom: '24px',
    animation: 'pulse 2s ease-in-out infinite',
  },
  blockingAlertIcon: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'var(--vds-colors-danger)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
    flexShrink: 0,
  },
  blockingAlertContent: {
    flex: 1,
  },
  blockingAlertLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '8px',
  },
  blockingAlertLink: {
    color: 'var(--vds-colors-danger)',
    fontWeight: '500',
    fontSize: '14px',
  },
  filters: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  filterBtn: {
    padding: '6px 14px',
    borderRadius: 'var(--vds-spacing-border-radius)',
    border: '1px solid var(--vds-colors-border)',
    background: 'transparent',
    color: 'var(--vds-colors-text-secondary)',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  filterBtnActive: {
    background: 'var(--vds-colors-primary)',
    color: 'white',
    borderColor: 'var(--vds-colors-primary)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    display: 'block',
    padding: 'var(--vds-spacing-card-padding)',
    background: 'var(--vds-colors-surface)',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusIcon: {
    fontSize: '12px',
    color: 'var(--vds-colors-primary)',
  },
  cardTitle: {
    flex: 1,
    fontWeight: '500',
    color: 'var(--vds-colors-text)',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  badgePassive: {
    background: 'var(--vds-colors-surface)',
    color: 'var(--vds-colors-text-secondary)',
    border: '1px solid var(--vds-colors-border)',
  },
  badgeInteractive: {
    background: 'var(--vds-colors-interactive-bg)',
    color: '#C2410C',
    border: '1px solid var(--vds-colors-interactive-border)',
  },
  badgeBlocking: {
    background: 'var(--vds-colors-blocking-bg)',
    color: 'var(--vds-colors-danger)',
    border: '1px solid var(--vds-colors-blocking-border)',
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '6px',
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
  },
  empty: {
    textAlign: 'center',
    padding: '48px 24px',
    color: 'var(--vds-colors-text-secondary)',
  },
  error: {
    textAlign: 'center',
    padding: '24px',
    color: 'var(--vds-colors-danger)',
  },
};
