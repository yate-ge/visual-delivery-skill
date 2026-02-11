import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchDelivery,
  saveFeedbackDraft,
  commitFeedback,
  revokeFeedback,
} from '../lib/api';
import { eventBus } from '../lib/eventBus';
import { t } from '../lib/i18n';
import { useDesignTokens } from '../hooks/useDesignTokens';
import ContentRenderer from '../components/ContentRenderer';
import FeedbackSidebar from '../components/feedback/FeedbackSidebar';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function createDraftItem(item) {
  return {
    ...item,
    id: item.id || `fd_local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: item.created_at || new Date().toISOString(),
  };
}

export default function DeliveryPage() {
  const { id } = useParams();
  const tokens = useDesignTokens();

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

  function replaceDraftByAction(oldAction, itemId) {
    // Remove draft with matching oldAction + item-id (mutual exclusion)
    const next = drafts.filter((item) => {
      if (item.kind !== 'interactive') return true;
      const draftAction = item.payload?.action;
      const draftItemId = item.payload?.['item-id'] || '';
      return !(draftAction === oldAction && draftItemId === itemId);
    });
    if (next.length !== drafts.length) {
      persistDrafts(next);
    }
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

  async function handleRevoke(feedbackId) {
    try {
      await revokeFeedback(id, [feedbackId]);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div style={styles.loading}>{t('loading')}</div>;
  if (error) return <div style={styles.error}>{t('errorPrefix')}: {error}</div>;
  if (!delivery) return <div style={styles.error}>{t('deliveryNotFound')}</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <Link to="/" style={styles.backLink}>{t('back')}</Link>
        <div style={styles.titleRow}>
          <h1 style={styles.title}>{delivery.title}</h1>
        </div>
        <div style={styles.metaRow}>
          {delivery.status === 'pending_feedback' && (
            <span style={styles.pendingBadge}>{t('statusPending')}</span>
          )}
          <span>{t('createdLabel')} {formatTime(delivery.updated_at || delivery.created_at)}</span>
        </div>
      </header>

      <div style={styles.layout}>
        <main style={styles.main}>
          <ContentRenderer
            content={delivery.content}
            tokens={tokens}
            onCreateAnnotation={addDraftItem}
            onCreateInteractive={addDraftItem}
            onReplaceDraft={replaceDraftByAction}
            drafts={drafts}
          />
        </main>

        <FeedbackSidebar
          drafts={drafts}
          feedback={delivery.feedback || []}
          onRemoveDraft={removeDraftItem}
          onAddInteractive={addDraftItem}
          onCommit={handleCommit}
          onRevoke={handleRevoke}
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
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    color: 'var(--vds-colors-text-secondary)',
  },
  pendingBadge: {
    background: 'var(--vds-colors-warning, #f59e0b)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '10px',
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
};
