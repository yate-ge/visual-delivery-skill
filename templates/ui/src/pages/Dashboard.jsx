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
