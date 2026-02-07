import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SelectableSurface from '../core/SelectableSurface';
import { t } from '../../lib/i18n';

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  return [];
}

function withComponentProps(component) {
  if (!component || typeof component !== 'object') return component;
  const next = { ...component };
  if (component.props && typeof component.props === 'object') {
    Object.assign(next, component.props);
  }
  if (component.data && typeof component.data === 'object') {
    Object.assign(next, component.data);
  }
  return next;
}

function getColumnLabel(column) {
  return column?.label || column?.header || column?.key || '';
}

function DataView({ component, onCreateInteractive }) {
  const rows = normalizeArray(component.rows);
  const columns = normalizeArray(component.columns);

  const [viewMode, setViewMode] = useState('table');
  const [query, setQuery] = useState('');
  const [orderKey, setOrderKey] = useState(columns[0]?.key || '');
  const [orderDir, setOrderDir] = useState('asc');

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    let next = rows;

    if (keyword) {
      next = rows.filter((row) =>
        Object.values(row || {}).some((value) =>
          String(value ?? '').toLowerCase().includes(keyword)
        )
      );
    }

    if (orderKey) {
      next = [...next].sort((a, b) => {
        const av = String(a?.[orderKey] ?? '');
        const bv = String(b?.[orderKey] ?? '');
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return orderDir === 'asc' ? cmp : -cmp;
      });
    }

    return next;
  }, [rows, query, orderKey, orderDir]);

  function pushCurrentState() {
    onCreateInteractive({
      kind: 'interactive',
      payload: {
        component_id: component.id,
        action: 'data_view_state',
        view_mode: viewMode,
        query,
        order_key: orderKey,
        order_dir: orderDir,
      },
      target: {
        component_id: component.id,
        target_type: 'data_view',
        anchor: component.title || component.id,
      },
    });
  }

  return (
    <div style={styles.cardBody}>
      <div style={styles.dataControls}>
        <div style={styles.inlineBtns}>
          <button
            onClick={() => setViewMode('table')}
            style={{ ...styles.pillBtn, ...(viewMode === 'table' ? styles.pillBtnActive : {}) }}
          >
            {t('table')}
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{ ...styles.pillBtn, ...(viewMode === 'list' ? styles.pillBtnActive : {}) }}
          >
            {t('list')}
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('filterRows')}
          style={styles.input}
        />

        <div style={styles.row}>
          <select value={orderKey} onChange={(e) => setOrderKey(e.target.value)} style={styles.select}>
            {columns.map((column) => (
              <option key={column.key} value={column.key}>{getColumnLabel(column)}</option>
            ))}
          </select>
          <select value={orderDir} onChange={(e) => setOrderDir(e.target.value)} style={styles.select}>
            <option value="asc">{t('asc')}</option>
            <option value="desc">{t('desc')}</option>
          </select>
        </div>

        <button onClick={pushCurrentState} style={styles.secondaryActionBtn}>
          {t('addViewStateFeedback')}
        </button>
      </div>

      {viewMode === 'table' ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} style={styles.th}>{getColumnLabel(column)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr key={`${component.id}-${idx}`}>
                  {columns.map((column) => (
                    <td key={`${column.key}-${idx}`} style={styles.td}>{String(row[column.key] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={styles.listView}>
          {filteredRows.map((row, idx) => (
            <div key={`${component.id}-list-${idx}`} style={styles.listItem}>
              {columns.map((column) => (
                <div key={`${component.id}-${column.key}-${idx}`} style={styles.listField}>
                  <strong>{getColumnLabel(column)}:</strong> {String(row[column.key] ?? '')}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DecisionForm({ component, onCreateInteractive }) {
  const fields = normalizeArray(component.fields);
  const [values, setValues] = useState(() => {
    const initial = {};
    fields.forEach((field) => {
      if (field.default !== undefined) initial[field.id] = field.default;
      else if (field.type === 'slider') initial[field.id] = field.min ?? 0;
      else initial[field.id] = '';
    });
    return initial;
  });

  function setField(fieldId, value) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function submit() {
    onCreateInteractive({
      kind: 'interactive',
      payload: {
        component_id: component.id,
        action: 'decision_form_submission',
        values,
      },
      target: {
        component_id: component.id,
        target_type: 'decision_form',
        anchor: component.title || component.id,
      },
    });
  }

  return (
    <div style={styles.cardBody}>
      <div style={styles.formFields}>
        {fields.map((field) => {
          const value = values[field.id] ?? '';
          if (field.type === 'select') {
            return (
              <label key={field.id} style={styles.fieldGroup}>
                <span style={styles.fieldLabel}>{field.label}</span>
                <select value={value} onChange={(e) => setField(field.id, e.target.value)} style={styles.select}>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
            );
          }

          if (field.type === 'slider') {
            return (
              <label key={field.id} style={styles.fieldGroup}>
                <span style={styles.fieldLabel}>{field.label}: {value}</span>
                <input
                  type="range"
                  min={field.min ?? 0}
                  max={field.max ?? 100}
                  step={field.step ?? 1}
                  value={value}
                  onChange={(e) => setField(field.id, Number(e.target.value))}
                />
              </label>
            );
          }

          return (
            <label key={field.id} style={styles.fieldGroup}>
              <span style={styles.fieldLabel}>{field.label}</span>
              <textarea
                value={value}
                placeholder={field.placeholder || ''}
                onChange={(e) => setField(field.id, e.target.value)}
                rows={3}
                style={styles.textarea}
              />
            </label>
          );
        })}
      </div>

      <button onClick={submit} style={styles.secondaryActionBtn}>
        {t('addFormResponseFeedback')}
      </button>
    </div>
  );
}

function MarkdownBlock({ component }) {
  const content = component.content || component.body || '';
  return (
    <div style={styles.cardBody}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function MetricGrid({ component }) {
  return (
    <div style={styles.metricGrid}>
      {normalizeArray(component.items).map((item, idx) => (
        <div key={`${component.id}-${idx}`} style={styles.metricItem}>
          <div style={styles.metricLabel}>{item.label}</div>
          <div style={styles.metricValue}>{item.value}</div>
          {item.note && <div style={styles.metricNote}>{item.note}</div>}
        </div>
      ))}
    </div>
  );
}

function StatsBar({ component }) {
  const items = normalizeArray(component.items);
  return (
    <div style={styles.cardBody}>
      <div style={styles.statsBarGrid}>
        {items.map((item, idx) => (
          <div key={`${component.id}-stat-${idx}`} style={styles.statsBarItem}>
            <div style={styles.statsBarLabel}>{item.label}</div>
            <div style={styles.statsBarValue}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroBanner({ component }) {
  return (
    <div style={styles.heroBanner}>
      <h2 style={styles.heroTitle}>{component.title || ''}</h2>
      {component.subtitle && <p style={styles.heroSubtitle}>{component.subtitle}</p>}
      {component.description && <p style={styles.heroDescription}>{component.description}</p>}
    </div>
  );
}

function SectionHeader({ component }) {
  const subtitle = component.subtitle || component.description;
  return (
    <div style={styles.cardBody}>
      <h3 style={styles.sectionHeaderTitle}>{component.title || ''}</h3>
      {subtitle && <p style={styles.sectionHeaderSubtitle}>{subtitle}</p>}
      {component.divider && <div style={styles.sectionDivider} />}
    </div>
  );
}

function CalloutBox({ component }) {
  return (
    <div style={styles.cardBody}>
      <div style={styles.calloutBox}>
        {component.title && <h4 style={styles.calloutTitle}>{component.title}</h4>}
        {component.content && <p style={styles.calloutContent}>{component.content}</p>}
      </div>
    </div>
  );
}

function CardGrid({ component }) {
  const cards = normalizeArray(component.cards);
  const columns = Number(component.columns) > 0 ? Number(component.columns) : 2;

  return (
    <div style={styles.cardBody}>
      <div style={{ ...styles.dynamicCardGrid, gridTemplateColumns: `repeat(${columns}, minmax(180px, 1fr))` }}>
        {cards.map((card, idx) => (
          <article key={`${component.id}-card-${idx}`} style={styles.dynamicCard}>
            {card.title && <h4 style={styles.dynamicCardTitle}>{card.title}</h4>}
            {card.description && <p style={styles.dynamicCardDesc}>{card.description}</p>}
            {normalizeArray(card.items).length > 0 && (
              <ul style={styles.dynamicCardList}>
                {normalizeArray(card.items).map((item, itemIdx) => (
                  <li key={`${component.id}-card-${idx}-item-${itemIdx}`} style={styles.dynamicCardListItem}>
                    {String(item)}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function FeatureBlock({ component }) {
  return (
    <div style={styles.cardBody}>
      <div style={styles.featureBlock}>
        <div style={styles.featureTop}>
          {component.number && <span style={styles.featureNumber}>{component.number}</span>}
          <h4 style={styles.featureTitle}>{component.title || ''}</h4>
        </div>
        {component.description && <p style={styles.featureDescription}>{component.description}</p>}
        {normalizeArray(component.highlights).length > 0 && (
          <div style={styles.featureHighlights}>
            {normalizeArray(component.highlights).map((item, idx) => (
              <div key={`${component.id}-highlight-${idx}`} style={styles.featureHighlightItem}>
                <strong>{item.label || ''}</strong>
                <span>{item.value || ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewTable({ component, onCreateInteractive }) {
  const rows = normalizeArray(component.rows);
  const decisionOptions = normalizeArray(component.decision_options).length > 0
    ? normalizeArray(component.decision_options)
    : ['confirm', 'reject', 'change_request'];

  const [decisions, setDecisions] = useState({});
  const [notes, setNotes] = useState({});

  function rowId(row, index) {
    return String(row.item_id || row.id || `row-${index + 1}`);
  }

  function setDecision(id, value) {
    setDecisions((prev) => ({ ...prev, [id]: value }));
  }

  function setNote(id, value) {
    setNotes((prev) => ({ ...prev, [id]: value }));
  }

  function submitRow(row, index) {
    const id = rowId(row, index);
    const decision = decisions[id];
    if (!decision) return;

    onCreateInteractive({
      kind: 'interactive',
      payload: {
        component_id: component.id,
        action: 'review_decision',
        item_id: id,
        decision,
        notes: (notes[id] || '').trim(),
        row,
      },
      target: {
        component_id: component.id,
        target_type: 'review_table',
        anchor: id,
      },
    });
  }

  return (
    <div style={styles.cardBody}>
      <div style={styles.reviewTableWrap}>
        {rows.length === 0 && <div style={styles.emptyReviewRows}>{t('noReviewItems')}</div>}
        {rows.map((row, index) => {
          const id = rowId(row, index);
          const decision = decisions[id] || '';
          const rowNote = notes[id] || '';

          return (
            <div key={`${component.id}-${id}`} style={styles.reviewRowCard}>
              <div style={styles.reviewRowHeader}>
                <div style={styles.reviewRowTitle}>
                  <code style={styles.reviewItemId}>{id}</code>
                  <span>{row.location || row.title || row.original || t('reviewItem')}</span>
                </div>
              </div>

              <div style={styles.reviewRowBody}>
                {row.issue && (
                  <div style={styles.reviewField}>
                    <span style={styles.reviewFieldLabel}>{t('issueLabel')}</span>
                    <p style={styles.reviewFieldText}>{String(row.issue)}</p>
                  </div>
                )}
                {row.suggestion && (
                  <div style={styles.reviewField}>
                    <span style={styles.reviewFieldLabel}>{t('suggestionLabel')}</span>
                    <p style={styles.reviewFieldText}>{String(row.suggestion)}</p>
                  </div>
                )}
              </div>

              <div style={styles.reviewActions}>
                <label style={styles.fieldGroup}>
                  <span style={styles.fieldLabel}>{t('decisionLabel')}</span>
                  <select
                    value={decision}
                    onChange={(e) => setDecision(id, e.target.value)}
                    style={styles.select}
                  >
                    <option value="">{t('selectDecision')}</option>
                    {decisionOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>

                <label style={styles.fieldGroup}>
                  <span style={styles.fieldLabel}>{t('notesLabel')}</span>
                  <textarea
                    value={rowNote}
                    onChange={(e) => setNote(id, e.target.value)}
                    placeholder={t('notesPlaceholder')}
                    rows={2}
                    style={styles.textarea}
                  />
                </label>

                <button
                  onClick={() => submitRow(row, index)}
                  disabled={!decision}
                  style={{
                    ...styles.secondaryActionBtn,
                    ...(!decision ? styles.secondaryActionBtnDisabled : {}),
                  }}
                >
                  {t('addReviewDecisionFeedback')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UnknownComponent({ component }) {
  const payload = component.content || component.body || component.description || component.text;
  return (
    <div style={styles.cardBody}>
      {payload ? (
        <p style={styles.unknownText}>{String(payload)}</p>
      ) : (
        <pre style={styles.unknownPre}>{JSON.stringify(component, null, 2)}</pre>
      )}
    </div>
  );
}

function renderComponent(component, onCreateInteractive) {
  switch (component.type) {
    case 'data_view':
    case 'data_table':
      return <DataView component={component} onCreateInteractive={onCreateInteractive} />;
    case 'decision_form':
      return <DecisionForm component={component} onCreateInteractive={onCreateInteractive} />;
    case 'metric_grid':
      return <MetricGrid component={component} />;
    case 'stats_row':
    case 'stats_bar':
      return <StatsBar component={component} />;
    case 'review_table':
      return <ReviewTable component={component} onCreateInteractive={onCreateInteractive} />;
    case 'hero':
    case 'hero_banner':
      return <HeroBanner component={component} />;
    case 'section_header':
      return <SectionHeader component={component} />;
    case 'callout_box':
      return <CalloutBox component={component} />;
    case 'card_grid':
      return <CardGrid component={component} />;
    case 'feature_block':
      return <FeatureBlock component={component} />;
    case 'markdown':
      return <MarkdownBlock component={component} />;
    default:
      return <UnknownComponent component={component} />;
  }
}

export default function RuntimeRenderer({ uiSpec, onCreateAnnotation, onCreateInteractive }) {
  const components = normalizeArray(uiSpec?.components).map(withComponentProps);

  if (!uiSpec || components.length === 0) {
    return (
      <div style={styles.empty}>
        {t('noUiSpecComponents')}
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      {components.map((component, idx) => {
        const componentId = component.id || `component-${idx + 1}`;
        return (
          <SelectableSurface
            key={componentId}
            componentId={componentId}
            onCreateAnnotation={onCreateAnnotation}
          >
            <section style={styles.card}>
              <header style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>{component.title || componentId}</h3>
                <span style={styles.typeTag}>{component.type}</span>
              </header>
              {renderComponent(component, onCreateInteractive)}
            </section>
          </SelectableSurface>
        );
      })}
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  card: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '12px',
    background: 'white',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    borderBottom: '1px solid var(--vds-colors-border)',
    background: 'var(--vds-colors-surface)',
  },
  cardTitle: {
    fontSize: '16px',
    color: 'var(--vds-colors-text)',
  },
  typeTag: {
    fontSize: '12px',
    textTransform: 'uppercase',
    color: 'var(--vds-colors-text-secondary)',
  },
  cardBody: {
    padding: '12px',
  },
  heroBanner: {
    padding: '18px',
    background: 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 100%)',
  },
  heroTitle: {
    margin: 0,
    fontSize: '24px',
    lineHeight: '1.3',
    color: 'var(--vds-colors-text)',
  },
  heroSubtitle: {
    margin: '10px 0 0 0',
    fontSize: '16px',
    color: 'var(--vds-colors-text-secondary)',
  },
  heroDescription: {
    margin: '10px 0 0 0',
    fontSize: '14px',
    color: 'var(--vds-colors-text-secondary)',
    lineHeight: '1.55',
  },
  sectionHeaderTitle: {
    margin: 0,
    fontSize: '18px',
    color: 'var(--vds-colors-text)',
  },
  sectionHeaderSubtitle: {
    margin: '8px 0 0 0',
    fontSize: '14px',
    color: 'var(--vds-colors-text-secondary)',
  },
  sectionDivider: {
    marginTop: '10px',
    height: '1px',
    background: 'var(--vds-colors-border)',
  },
  calloutBox: {
    border: '1px solid var(--vds-colors-border)',
    background: 'var(--vds-colors-surface)',
    borderRadius: '10px',
    padding: '12px',
  },
  calloutTitle: {
    margin: 0,
    fontSize: '16px',
    color: 'var(--vds-colors-text)',
  },
  calloutContent: {
    margin: '8px 0 0 0',
    fontSize: '14px',
    color: 'var(--vds-colors-text)',
    lineHeight: '1.55',
  },
  dynamicCardGrid: {
    display: 'grid',
    gap: '10px',
  },
  dynamicCard: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '10px',
    padding: '10px',
    background: 'var(--vds-colors-surface)',
  },
  dynamicCardTitle: {
    margin: 0,
    fontSize: '15px',
    color: 'var(--vds-colors-text)',
  },
  dynamicCardDesc: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    color: 'var(--vds-colors-text)',
    lineHeight: '1.5',
  },
  dynamicCardList: {
    margin: '8px 0 0 18px',
    padding: 0,
  },
  dynamicCardListItem: {
    marginBottom: '4px',
    fontSize: '13px',
    color: 'var(--vds-colors-text)',
  },
  featureBlock: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '10px',
    padding: '12px',
    background: 'var(--vds-colors-surface)',
  },
  featureTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  featureNumber: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '36px',
    height: '24px',
    borderRadius: '999px',
    border: '1px solid var(--vds-colors-border)',
    background: 'white',
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--vds-colors-text-secondary)',
  },
  featureTitle: {
    margin: 0,
    fontSize: '15px',
    color: 'var(--vds-colors-text)',
  },
  featureDescription: {
    margin: '10px 0 0 0',
    fontSize: '14px',
    color: 'var(--vds-colors-text)',
    lineHeight: '1.55',
  },
  featureHighlights: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  featureHighlightItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    background: 'white',
    padding: '8px',
    fontSize: '13px',
    color: 'var(--vds-colors-text)',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px',
    padding: '12px',
  },
  metricItem: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '10px',
    padding: '10px',
    background: 'var(--vds-colors-surface)',
  },
  metricLabel: {
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
  },
  metricValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--vds-colors-text)',
    marginTop: '4px',
  },
  metricNote: {
    fontSize: '12px',
    color: 'var(--vds-colors-text-secondary)',
    marginTop: '4px',
  },
  statsBarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '10px',
  },
  statsBarItem: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '10px',
    padding: '10px',
    background: 'var(--vds-colors-surface)',
  },
  statsBarLabel: {
    fontSize: '12px',
    color: 'var(--vds-colors-text-secondary)',
  },
  statsBarValue: {
    marginTop: '4px',
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--vds-colors-text)',
  },
  dataControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '10px',
  },
  inlineBtns: {
    display: 'flex',
    gap: '8px',
  },
  pillBtn: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '999px',
    background: 'white',
    color: 'var(--vds-colors-text-secondary)',
    padding: '4px 10px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  pillBtnActive: {
    background: 'var(--vds-colors-primary)',
    color: 'white',
    borderColor: 'var(--vds-colors-primary)',
  },
  row: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  select: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    background: 'white',
    outline: 'none',
  },
  textarea: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
  },
  secondaryActionBtn: {
    alignSelf: 'flex-start',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    background: 'white',
    color: 'var(--vds-colors-text)',
    padding: '8px 10px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondaryActionBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  tableWrap: {
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    borderBottom: '1px solid var(--vds-colors-border)',
    padding: '8px',
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
  },
  td: {
    borderBottom: '1px solid var(--vds-colors-border)',
    padding: '8px',
    fontSize: '14px',
  },
  listView: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  listItem: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    padding: '8px',
    background: 'var(--vds-colors-surface)',
  },
  listField: {
    fontSize: '13px',
    color: 'var(--vds-colors-text)',
    marginBottom: '4px',
  },
  formFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '10px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
  },
  reviewTableWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  reviewRowCard: {
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '10px',
    background: 'var(--vds-colors-surface)',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  reviewRowHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewRowTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: 'var(--vds-colors-text)',
    fontWeight: '600',
  },
  reviewItemId: {
    fontSize: '12px',
    border: '1px solid var(--vds-colors-border)',
    background: 'white',
    borderRadius: '6px',
    padding: '2px 6px',
    color: 'var(--vds-colors-text-secondary)',
  },
  reviewRowBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  reviewField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  reviewFieldLabel: {
    fontSize: '12px',
    color: 'var(--vds-colors-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  reviewFieldText: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--vds-colors-text)',
    lineHeight: '1.5',
  },
  reviewActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  emptyReviewRows: {
    border: '1px dashed var(--vds-colors-border)',
    borderRadius: '8px',
    background: 'white',
    padding: '12px',
    fontSize: '13px',
    color: 'var(--vds-colors-text-secondary)',
  },
  unknownText: {
    margin: 0,
    fontSize: '14px',
    lineHeight: '1.55',
    color: 'var(--vds-colors-text)',
  },
  unknownPre: {
    margin: 0,
    fontSize: '12px',
    lineHeight: '1.45',
    border: '1px solid var(--vds-colors-border)',
    borderRadius: '8px',
    background: 'var(--vds-colors-surface)',
    padding: '10px',
    overflow: 'auto',
  },
  empty: {
    border: '1px dashed var(--vds-colors-border)',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '15px',
  },
};
