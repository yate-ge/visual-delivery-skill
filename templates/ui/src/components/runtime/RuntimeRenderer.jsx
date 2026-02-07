import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SelectableSurface from '../core/SelectableSurface';

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  return [];
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
            Table
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{ ...styles.pillBtn, ...(viewMode === 'list' ? styles.pillBtnActive : {}) }}
          >
            List
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter rows"
          style={styles.input}
        />

        <div style={styles.row}>
          <select value={orderKey} onChange={(e) => setOrderKey(e.target.value)} style={styles.select}>
            {columns.map((column) => (
              <option key={column.key} value={column.key}>{column.label || column.key}</option>
            ))}
          </select>
          <select value={orderDir} onChange={(e) => setOrderDir(e.target.value)} style={styles.select}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>

        <button onClick={pushCurrentState} style={styles.secondaryActionBtn}>
          Add this view state to feedback
        </button>
      </div>

      {viewMode === 'table' ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} style={styles.th}>{column.label || column.key}</th>
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
                  <strong>{column.label || column.key}:</strong> {String(row[column.key] ?? '')}
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
        Add form response to feedback
      </button>
    </div>
  );
}

function MarkdownBlock({ component }) {
  return (
    <div style={styles.cardBody}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{component.content || ''}</ReactMarkdown>
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

function renderComponent(component, onCreateInteractive) {
  switch (component.type) {
    case 'data_view':
      return <DataView component={component} onCreateInteractive={onCreateInteractive} />;
    case 'decision_form':
      return <DecisionForm component={component} onCreateInteractive={onCreateInteractive} />;
    case 'metric_grid':
      return <MetricGrid component={component} />;
    case 'markdown':
    default:
      return <MarkdownBlock component={component} />;
  }
}

export default function RuntimeRenderer({ uiSpec, onCreateAnnotation, onCreateInteractive }) {
  const components = normalizeArray(uiSpec?.components);

  if (!uiSpec || components.length === 0) {
    return (
      <div style={styles.empty}>
        No UI specification components were provided.
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      {components.map((component) => (
        <SelectableSurface
          key={component.id}
          componentId={component.id}
          onCreateAnnotation={onCreateAnnotation}
        >
          <section style={styles.card}>
            <header style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>{component.title || component.id}</h3>
              <span style={styles.typeTag}>{component.type}</span>
            </header>
            {renderComponent(component, onCreateInteractive)}
          </section>
        </SelectableSurface>
      ))}
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
  empty: {
    border: '1px dashed var(--vds-colors-border)',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    color: 'var(--vds-colors-text-secondary)',
    fontSize: '15px',
  },
};
