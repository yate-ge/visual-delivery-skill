import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchDelivery, submitFeedback, addAnnotation } from '../lib/api';
import { eventBus } from '../lib/eventBus';
import ContentRenderer from '../components/ContentRenderer';
import FeedbackRenderer from '../components/feedback/FeedbackRenderer';
import AnnotationSidebar from '../components/AnnotationSidebar';
import { t } from '../lib/i18n';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  return t('daysAgo', { n: days });
}

export default function DeliveryPage() {
  const { id } = useParams();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchDelivery(id);
      setDelivery(data);
      setFeedbackSubmitted(data.feedback && data.feedback.length > 0);
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

  // Listen for real-time feedback updates
  useEffect(() => {
    const onFeedback = (data) => {
      if (data.delivery_id === id) {
        load();
      }
    };
    eventBus.on('feedback_received', onFeedback);
    return () => eventBus.off('feedback_received', onFeedback);
  }, [id, load]);

  const handleFeedbackSubmit = async (values) => {
    try {
      await submitFeedback(id, values);
      setFeedbackSubmitted(true);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddAnnotation = async () => {
    if (!annotationText.trim()) return;
    try {
      await addAnnotation(id, {
        type: 'comment',
        content: annotationText.trim(),
        target: null
      });
      setAnnotationText('');
      setShowAnnotationInput(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (error) return <div style={styles.error}>Error: {error}</div>;
  if (!delivery) return <div style={styles.error}>{t('deliveryNotFound')}</div>;

  const isBlocking = delivery.mode === 'blocking' && delivery.status === 'awaiting_feedback';
  const hasFeedbackSchema = delivery.feedback_schema && !feedbackSubmitted;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.backLink}>{t('backToList')}</Link>
        <div style={styles.headerRight}>
          <h1 style={styles.title}>{delivery.title}</h1>
          <div style={styles.meta}>
            <span style={{
              ...styles.badge,
              ...(delivery.mode === 'blocking' ? styles.badgeBlocking :
                  delivery.mode === 'interactive' ? styles.badgeInteractive :
                  styles.badgePassive)
            }}>
              {delivery.mode}
            </span>
            <span>{delivery.status.replace('_', ' ')}</span>
            <span>{timeAgo(delivery.created_at)}</span>
          </div>
        </div>
      </header>

      {isBlocking && (
        <div style={styles.waitingBanner}>
          {t('agentWaiting')}
        </div>
      )}

      <div style={styles.body}>
        <div style={styles.contentArea}>
          <ContentRenderer content={delivery.content} />

          {hasFeedbackSchema && (
            <div style={styles.feedbackSection}>
              <h2 style={styles.sectionTitle}>{t('yourFeedback')}</h2>
              <FeedbackRenderer
                schema={delivery.feedback_schema}
                onSubmit={handleFeedbackSubmit}
              />
            </div>
          )}

          {feedbackSubmitted && delivery.feedback && delivery.feedback.length > 0 && (
            <div style={styles.feedbackDone}>
              <div style={styles.feedbackDoneIcon}>{'\u2713'}</div>
              <div>
                <strong>{t('feedbackSubmitted')}</strong>
                <pre style={styles.feedbackPreview}>
                  {JSON.stringify(delivery.feedback[delivery.feedback.length - 1].values, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h3 style={styles.sidebarTitle}>{t('annotations')}</h3>
            <button
              onClick={() => setShowAnnotationInput(!showAnnotationInput)}
              style={styles.addBtn}
            >
              {t('addComment')}
            </button>
          </div>

          {showAnnotationInput && (
            <div style={styles.annotationInput}>
              <textarea
                value={annotationText}
                onChange={e => setAnnotationText(e.target.value)}
                placeholder={t('addCommentPlaceholder')}
                style={styles.textarea}
                rows={3}
              />
              <div style={styles.annotationActions}>
                <button onClick={handleAddAnnotation} style={styles.submitBtn}>{t('submit')}</button>
                <button onClick={() => { setShowAnnotationInput(false); setAnnotationText(''); }} style={styles.cancelBtn}>{t('cancel')}</button>
              </div>
            </div>
          )}

          <AnnotationSidebar annotations={delivery.annotations || []} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1100px',
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
    marginBottom: '24px',
  },
  backLink: {
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '14px',
    display: 'inline-block',
    marginBottom: '12px',
  },
  headerRight: {},
  title: {
    fontSize: '22px',
    fontWeight: '600',
    color: 'var(--vds-colors-text)',
    marginBottom: '8px',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'uppercase',
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
  waitingBanner: {
    background: 'var(--vds-colors-blocking-bg)',
    border: '1px solid var(--vds-colors-blocking-border)',
    color: 'var(--vds-colors-danger)',
    padding: '12px 16px',
    borderRadius: 'var(--vds-spacing-border-radius)',
    fontWeight: '500',
    marginBottom: '24px',
    textAlign: 'center',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '24px',
  },
  contentArea: {},
  feedbackSection: {
    marginTop: '32px',
    padding: '24px',
    background: 'var(--vds-colors-surface)',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
  },
  feedbackDone: {
    marginTop: '24px',
    display: 'flex',
    gap: '12px',
    padding: '16px',
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: 'var(--vds-spacing-border-radius)',
  },
  feedbackDoneIcon: {
    color: 'var(--vds-colors-success)',
    fontSize: '20px',
    fontWeight: 'bold',
  },
  feedbackPreview: {
    marginTop: '8px',
    fontSize: '12px',
    background: 'var(--vds-colors-surface)',
    padding: '8px',
    borderRadius: '4px',
    overflow: 'auto',
    fontFamily: 'var(--vds-typography-font-family-mono)',
  },
  sidebar: {
    borderLeft: '1px solid var(--vds-colors-border)',
    paddingLeft: '24px',
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sidebarTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--vds-colors-text)',
  },
  addBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--vds-colors-primary)',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  annotationInput: {
    marginBottom: '16px',
  },
  textarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    fontFamily: 'inherit',
    fontSize: '13px',
    resize: 'vertical',
    outline: 'none',
  },
  annotationActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  submitBtn: {
    padding: '6px 14px',
    background: 'var(--vds-colors-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--vds-spacing-border-radius)',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  cancelBtn: {
    padding: '6px 14px',
    background: 'transparent',
    color: 'var(--vds-colors-text-secondary)',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: 'var(--vds-spacing-border-radius)',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
};
