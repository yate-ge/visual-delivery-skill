import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDeliveries } from '../hooks/useDeliveries';
import { t } from '../lib/i18n';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function displayTime(delivery) {
  const time = delivery.updated_at && delivery.updated_at !== delivery.created_at
    ? delivery.updated_at
    : delivery.created_at;
  return formatTime(time);
}

export default function Dashboard() {
  const { deliveries, loading, error } = useDeliveries();

  const filtered = useMemo(() => {
    return [...deliveries].sort((a, b) => {
      if (a.status === 'pending_feedback' && b.status !== 'pending_feedback') return -1;
      if (a.status !== 'pending_feedback' && b.status === 'pending_feedback') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [deliveries]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('appTitle')}</h1>
          <div style={styles.accent} />
        </div>
        <Link to="/settings" style={styles.settingsLink}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: '-3px' }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {t('settings')}
        </Link>
      </header>

      {loading && <div style={styles.loadingText}>{t('loadingDeliveries')}</div>}
      {error && <div style={styles.error}>Error: {error}</div>}

      {!loading && filtered.length === 0 && (
        <div style={styles.emptyState}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={styles.emptyIcon}>
            <rect x="8" y="6" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
            <line x1="16" y1="16" x2="32" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="22" x2="28" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="28" x2="24" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div style={styles.emptyTitle}>{t('noDeliveries')}</div>
          <div style={styles.emptyHint}>{t('noDeliveriesHint')}</div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={styles.list}>
          {filtered.map((delivery) => (
            <Link key={delivery.id} to={`/d/${delivery.id}`} style={styles.card} className="delivery-card">
              <div style={styles.cardTop}>
                <span style={styles.cardTitle}>{delivery.title}</span>
                {delivery.status === 'pending_feedback' && (
                  <span style={{ ...styles.status, ...styles.pending }}>
                    {t('statusPending')}
                  </span>
                )}
              </div>

              <div style={styles.cardMeta}>
                <span>{displayTime(delivery)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '920px',
    margin: '0 auto',
    padding: 'var(--vds-spacing-page-padding)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '36px',
    paddingBottom: '20px',
    borderBottom: '1px solid var(--vds-colors-border)',
  },
  title: {
    fontSize: '26px',
    color: 'var(--vds-colors-text)',
    fontWeight: '700',
    letterSpacing: '-0.3px',
  },
  accent: {
    width: '32px',
    height: '3px',
    borderRadius: '2px',
    background: 'var(--vds-colors-primary)',
    marginTop: '8px',
  },
  settingsLink: {
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '14px',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid var(--vds-colors-border)',
    background: 'var(--vds-colors-surface)',
    textDecoration: 'none',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  card: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '12px',
    padding: '16px 18px',
    textDecoration: 'none',
    color: 'inherit',
    background: 'white',
    borderLeft: '3px solid transparent',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    fontSize: '16px',
    color: 'var(--vds-colors-text)',
    fontWeight: '600',
  },
  status: {
    fontSize: '12px',
    borderRadius: '999px',
    textTransform: 'uppercase',
    padding: '3px 8px',
    fontWeight: '600',
  },
  pending: {
    background: '#FEF2F2',
    color: '#991B1B',
    border: '1px solid #FCA5A5',
  },
  cardMeta: {
    display: 'flex',
    gap: '10px',
    marginTop: '8px',
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '13px',
  },
  loadingText: {
    textAlign: 'center',
    color: 'var(--vds-colors-text-secondary)',
    padding: '36px 10px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '72px 20px',
    border: '2px dashed var(--vds-colors-border)',
    borderRadius: '16px',
    background: 'var(--vds-colors-surface)',
    gap: '8px',
  },
  emptyIcon: {
    color: 'var(--vds-colors-border)',
    marginBottom: '4px',
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--vds-colors-text-secondary)',
  },
  emptyHint: {
    fontSize: '14px',
    color: 'var(--vds-colors-text-secondary)',
    opacity: 0.7,
  },
  error: {
    color: 'var(--vds-colors-danger)',
    textAlign: 'center',
    padding: '14px',
  },
};
