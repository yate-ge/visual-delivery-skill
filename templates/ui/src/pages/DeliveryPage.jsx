import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchDelivery,
  saveFeedbackDraft,
  commitFeedback,
} from '../lib/api';
import { eventBus } from '../lib/eventBus';
import { t } from '../lib/i18n';
import ContentRenderer from '../components/ContentRenderer';
import FeedbackSidebar from '../components/feedback/FeedbackSidebar';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('justNow');
  if (min < 60) return t('minAgo', { n: min });
  const hour = Math.floor(min / 60);
  if (hour < 24) return t('hoursAgo', { n: hour });
  const day = Math.floor(hour / 24);
  return t('daysAgo', { n: day });
}

function createDraftItem(item) {
  return {
    ...item,
    id: item.id || `fd_local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: item.created_at || new Date().toISOString(),
  };
}

function cleanMetaLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  if (text === 'Untitled Project' || text === 'Untitled Task') return '-';
  return text;
}

export default function DeliveryPage() {
  const { id } = useParams();

  const [delivery, setDelivery] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchDelivery(id);
      setDelivery(data);
      setDrafts(data.drafts || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onDeliveryUpdate(payload) {
      if (payload.id === id || payload.delivery_id === id) {
        load();
      }
    }

    eventBus.on('feedback_received', onDeliveryUpdate);
    eventBus.on('update_delivery', onDeliveryUpdate);

    return () => {
      eventBus.off('feedback_received', onDeliveryUpdate);
      eventBus.off('update_delivery', onDeliveryUpdate);
    };
  }, [id, load]);

  async function persistDrafts(nextDrafts) {
    setDrafts(nextDrafts);
    try {
      await saveFeedbackDraft(id, nextDrafts);
    } catch (err) {
      setError(err.message);
    }
  }

  function addDraftItem(item) {
    const next = [...drafts, createDraftItem(item)];
    persistDrafts(next);
  }

  function removeDraftItem(draftId) {
    const next = drafts.filter((item) => item.id !== draftId);
    persistDrafts(next);
  }

  async function handleCommit() {
    if (drafts.length === 0) return;

    setSubmitting(true);
    try {
      await commitFeedback(id, drafts);
      await persistDrafts([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={styles.loading}>{t('loading')}</div>;
  if (error) return <div style={styles.error}>{t('errorPrefix')}: {error}</div>;
  if (!delivery) return <div style={styles.error}>{t('deliveryNotFound')}</div>;

  const metadata = delivery.metadata || {};
  const pendingCount = (delivery.feedback || []).filter((item) => item.handled === false).length;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <Link to="/" style={styles.backLink}>{t('back')}</Link>
        <div style={styles.titleRow}>
          <h1 style={styles.title}>{delivery.title}</h1>
          {delivery.mode === 'alignment' && <span style={{ ...styles.modeBadge, ...styles.modeAlign }}>{t('alignmentBadge')}</span>}
        </div>
        <div style={styles.metaRow}>
          <span>{t('statusLabel')}: {delivery.status}</span>
          <span>{t('createdLabel')} {timeAgo(delivery.created_at)}</span>
          {delivery.mode === 'alignment' && <span>{t('alignmentLabel')}: {delivery.alignment_state || t('notAvailable')}</span>}
        </div>
      </header>

      <section style={styles.sourceInfo}>
        <div><strong>{t('projectLabel')}:</strong> {cleanMetaLabel(metadata.project_name)}</div>
        <div><strong>{t('taskLabel')}:</strong> {cleanMetaLabel(metadata.task_name)}</div>
        <div><strong>{t('generatedLabel')}:</strong> {metadata.generated_at || delivery.created_at}</div>
      </section>

      {delivery.mode === 'alignment' && (
        <div style={styles.alignmentNotice}>
          {t('alignmentNotice')}
        </div>
      )}

      <div style={styles.layout}>
        <main style={styles.main}>
          <ContentRenderer
            content={delivery.content}
            onCreateAnnotation={addDraftItem}
            onCreateInteractive={addDraftItem}
          />

          <section style={styles.feedbackState}>
            <h3 style={styles.feedbackStateTitle}>{t('feedbackStateTitle')}</h3>
            <div style={styles.feedbackStateBody}>
              <div>{t('pendingFeedbackEntries')}: {pendingCount}</div>
              <div>{t('resolvedFeedbackEntries')}: {(delivery.feedback || []).length - pendingCount}</div>
            </div>
          </section>
        </main>

        <FeedbackSidebar
          drafts={drafts}
          feedback={delivery.feedback || []}
          onRemoveDraft={removeDraftItem}
          onAddInteractive={addDraftItem}
          onCommit={handleCommit}
          submitting={submitting}
        />
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: '1240px',
    margin: '0 auto',
    padding: 'var(--vds-spacing-page-padding)',
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: 'var(--vds-colors-text-secondary)',
  },
  error: {
    textAlign: 'center',
    padding: '48px',
    color: 'var(--vds-colors-danger)',
  },
  header: {
    marginBottom: '16px',
  },
  backLink: {
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '15px',
    display: 'inline-block',
    marginBottom: '10px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  title: {
    fontSize: '24px',
    color: 'var(--vds-colors-text)',
  },
  modeBadge: {
    textTransform: 'uppercase',
    fontSize: '12px',
    borderRadius: '999px',
    padding: '3px 10px',
    border: '1px solid transparent',
    fontWeight: '600',
  },
  modeAlign: {
    background: '#FFFBEB',
    color: '#92400E',
    borderColor: '#FCD34D',
  },
  metaRow: {
    display: 'flex',
    gap: '12px',
    fontSize: '14px',
    color: 'var(--vds-colors-text-secondary)',
  },
  sourceInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '8px',
    padding: '12px',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '12px',
    background: 'var(--vds-colors-surface)',
    marginBottom: '14px',
    fontSize: '14px',
  },
  alignmentNotice: {
    border: '1px solid #FCD34D',
    background: '#FFFBEB',
    color: '#92400E',
    borderRadius: '10px',
    padding: '10px 12px',
    marginBottom: '14px',
    fontSize: '14px',
  },
  layout: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: '16px',
  },
  main: {
    minWidth: 0,
    flex: '1 1 680px',
  },
  feedbackState: {
    marginTop: '14px',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '12px',
    background: 'var(--vds-colors-surface)',
    padding: '12px',
  },
  feedbackStateTitle: {
    fontSize: '15px',
    marginBottom: '8px',
  },
  feedbackStateBody: {
    display: 'flex',
    gap: '12px',
    fontSize: '14px',
    color: 'var(--vds-colors-text-secondary)',
  },
};
