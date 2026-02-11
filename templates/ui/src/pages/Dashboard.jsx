import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDeliveries } from '../hooks/useDeliveries';
import { t } from '../lib/i18n';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('justNow');
  if (min < 60) return t('minAgo', { n: min });
  const hour = Math.floor(min / 60);
  if (hour < 24) return t('hoursAgo', { n: hour });
  const day = Math.floor(hour / 24);
  return t('daysAgo', { n: day });
}

function statusLabel(status) {
  if (status === 'pending_feedback') return t('statusPending');
  return t('statusNormal');
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
        <h1 style={styles.title}>{t('appTitle')}</h1>
        <Link to="/settings" style={styles.settingsLink}>{t('settings')}</Link>
      </header>

      {loading && <div style={styles.empty}>{t('loadingDeliveries')}</div>}
      {error && <div style={styles.error}>Error: {error}</div>}

      {!loading && filtered.length === 0 && (
        <div style={styles.empty}>{t('noDeliveries')}</div>
      )}

      <div style={styles.list}>
        {filtered.map((delivery) => (
          <Link key={delivery.id} to={`/d/${delivery.id}`} style={styles.card}>
            <div style={styles.cardTop}>
              <span style={styles.cardTitle}>{delivery.title}</span>
              <span
                style={{
                  ...styles.status,
                  ...(delivery.status === 'pending_feedback' ? styles.pending : styles.normal),
                }}
              >
                {statusLabel(delivery.status)}
              </span>
            </div>

            <div style={styles.cardMeta}>
              <span>{timeAgo(delivery.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>
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
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    color: 'var(--vds-colors-text)',
  },
  settingsLink: {
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '15px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  card: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '12px',
    padding: '12px',
    textDecoration: 'none',
    color: 'inherit',
    background: 'white',
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
  normal: {
    background: '#ECFDF5',
    color: '#065F46',
    border: '1px solid #6EE7B7',
  },
  cardMeta: {
    display: 'flex',
    gap: '10px',
    marginTop: '8px',
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '13px',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--vds-colors-text-secondary)',
    padding: '36px 10px',
  },
  error: {
    color: 'var(--vds-colors-danger)',
    textAlign: 'center',
    padding: '14px',
  },
};
