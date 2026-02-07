import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDeliveries } from '../hooks/useDeliveries';
import { t } from '../lib/i18n';

const MODE_FILTERS = ['all', 'task_delivery', 'alignment'];

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

function modeLabel(mode) {
  if (mode === 'task_delivery') return t('modeTask');
  if (mode === 'alignment') return t('modeAlignment');
  return t('modeAll');
}

function statusLabel(status) {
  if (status === 'pending_feedback') return t('statusPending');
  return t('statusNormal');
}

export default function Dashboard() {
  const { deliveries, loading, error } = useDeliveries();
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const byMode = filter === 'all' ? deliveries : deliveries.filter((item) => item.mode === filter);
    return [...byMode].sort((a, b) => {
      if (a.status === 'pending_feedback' && b.status !== 'pending_feedback') return -1;
      if (a.status !== 'pending_feedback' && b.status === 'pending_feedback') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [deliveries, filter]);

  const activeAlignment = deliveries.find(
    (item) => item.mode === 'alignment' && item.alignment_state === 'active'
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>{t('appTitle')}</h1>
        <Link to="/settings" style={styles.settingsLink}>{t('settings')}</Link>
      </header>

      {activeAlignment && (
        <div style={styles.alignmentBanner}>
          <div style={styles.bannerTitle}>{t('activeAlignment')}</div>
          <Link to={`/d/${activeAlignment.id}`} style={styles.bannerLink}>
            {activeAlignment.title}
          </Link>
        </div>
      )}

      <div style={styles.filters}>
        {MODE_FILTERS.map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            style={{
              ...styles.filterBtn,
              ...(filter === mode ? styles.filterBtnActive : {}),
            }}
          >
            {modeLabel(mode)}
          </button>
        ))}
      </div>

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
              <span>{modeLabel(delivery.mode)}</span>
              {delivery.mode === 'alignment' && <span>{delivery.alignment_state || t('inactive')}</span>}
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
  alignmentBanner: {
    border: '1px solid #FCD34D',
    background: '#FFFBEB',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '16px',
  },
  bannerTitle: {
    fontSize: '13px',
    textTransform: 'uppercase',
    color: '#92400E',
    marginBottom: '4px',
  },
  bannerLink: {
    fontSize: '16px',
    color: '#92400E',
    fontWeight: '600',
    textDecoration: 'none',
  },
  filters: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  filterBtn: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '999px',
    background: 'white',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    color: 'var(--vds-colors-text-secondary)',
    fontFamily: 'inherit',
  },
  filterBtnActive: {
    background: 'var(--vds-colors-primary)',
    borderColor: 'var(--vds-colors-primary)',
    color: 'white',
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
